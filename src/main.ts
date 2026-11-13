// ============================================================================
// TURBOCORE 入口：单一 progress 真相 → 每帧无条件 applyProgress；
// 状态机（reducer/store）驱动 UI 与场景；模式切换永不重建场景。
// ============================================================================
import * as THREE from 'three';
import { EngineScene } from './three/EngineScene';
import { Picker } from './three/picking';
import { PreviewScene } from './three/previewScene';
import { setHighlight, setHover } from './three/materials';
import { clamp01 } from './three/explode';
import { deriveOpacity } from './state/reducer';
import { store, type AppState } from './state/store';
import { PARTS, partById } from './data/parts';
import { TreePanel } from './ui/tree';
import { SwitchesPanel, type SceneActions } from './ui/switches';
import { BottomBar } from './ui/bottomBar';
import { TopBar } from './ui/topbar';
import { InspectorPanel } from './ui/inspector';
import { showToast } from './ui/toast';
import { $ } from './ui/dom';

const isMobile = window.matchMedia('(max-width: 768px)').matches;

// ---- 场景（全生命周期唯一实例；模式/剖切只改状态，不重建） ----
const scene = new EngineScene($('#viewport'), $('#label-layer'), {
  airflowCount: isMobile ? 500 : 1200,
});

const sceneActions: SceneActions = {
  setLabels: (on) => scene.setLabels(on),
  setClip: (on, offset) => scene.setClip(on, offset),
  setGlow: (on) => scene.setGlow(on),
  setDust: (on) => scene.setDust(on),
  setAirflow: (on) => scene.setAirflow(on),
  setShadows: (on) => scene.setShadows(on),
  setAutoRotate: (on) => scene.setAutoRotate(on),
  resetView: () => scene.resetView(true),
};

// 初始开关状态一次性同步到场景：AirflowLayer 等默认可见，若不同步，
// 首次点击“气流演示”只改 store 而画面无变化（用户反馈“点了没反应”的根因之一）。
{
  const s0 = store.get();
  sceneActions.setLabels(s0.labelsVisible);
  sceneActions.setClip(s0.clipEnabled, s0.clipOffset);
  sceneActions.setGlow(s0.glow);
  sceneActions.setDust(s0.dust);
  sceneActions.setAirflow(s0.airflow);
  sceneActions.setShadows(s0.shadows);
  sceneActions.setAutoRotate(s0.autoRotate);
}

/** 本体/剖切视图：开启时进入剖切模式 + 启用真实裁切平面 */
function toggleSectionView(): void {
  const s = store.get();
  const on = !s.clipEnabled;
  if (on) {
    store.selectMode('section');
    store.set({ clipEnabled: true });
    scene.setClip(true, s.clipOffset);
  } else {
    store.set({ clipEnabled: false });
    scene.setClip(false, s.clipOffset);
  }
}

// ---- UI ----
const inspector = new InspectorPanel({
  onSelectPart: (id) => store.set({ selectedId: id }),
  onFocus: (id) => scene.focusPart(id),
  onBack: () => store.set({ selectedId: null }),
});
const preview = new PreviewScene(inspector.previewCanvas);
const topbar = new TopBar(sceneActions);
new SwitchesPanel(sceneActions);
new BottomBar({
  onResetView: () => scene.resetView(true),
  onSectionView: toggleSectionView,
});
new TreePanel({ onSelectPart: (id) => store.set({ selectedId: id }) });

// ---- 拾取：hover 高亮 + 点击选中（只拾取可见零件） ----
new Picker(
  scene.renderer.domElement,
  scene.camera,
  () => scene.pickableList(store.get().hiddenIds),
  {
    onHover: (id) => setHoverPart(id),
    onSelect: (id) => store.set({ selectedId: id }),
  },
);

let hoverId: number | null = null;

function setHoverPart(id: number | null): void {
  if (hoverId === id) return;
  if (hoverId !== null) {
    const prev = scene.nodes.get(hoverId);
    if (prev) setHover(prev.mats, false);
  }
  hoverId = id;
  if (id !== null) {
    const node = scene.nodes.get(id);
    if (node) setHover(node.mats, true);
  }
}

// ---- 选中 / 显隐 / 隔离 → 场景不透明度、高亮、预览 ----
let lastSelected: number | null = null;

function setOpacity(m: THREE.MeshStandardMaterial, o: number): void {
  m.opacity = o;
  m.transparent = o < 1;
}

function applySelection(s: AppState): void {
  for (const [id, node] of scene.nodes) {
    node.group.visible = !s.hiddenIds.includes(id);
    const o = deriveOpacity(s, id, s.focusFade);
    setHighlight(node.mats, s.selectedId === id);
    setOpacity(node.mats.solid, o);
    if (node.mats.ghost) setOpacity(node.mats.ghost, o * 0.12);
  }
  if (lastSelected !== s.selectedId) {
    lastSelected = s.selectedId;
    if (s.selectedId === null) preview.clear();
    else {
      const node = scene.nodes.get(s.selectedId);
      if (node) preview.setPart(node);
    }
  }
}

store.subscribe((s) => applySelection(s));
applySelection(store.get());

// ---- 键盘快捷键 ----
window.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
  const s = store.get();
  switch (ev.code) {
    case 'Space':
      ev.preventDefault();
      store.togglePlay();
      break;
    case 'KeyR':
      store.startReassemble();
      break;
    case 'KeyV':
      scene.resetView(true);
      break;
    case 'KeyS':
      toggleSectionView();
      break;
    case 'KeyF':
      if (s.selectedId !== null) scene.focusPart(s.selectedId);
      break;
    case 'KeyI':
      if (s.selectedId !== null) {
        const p = partById(s.selectedId);
        store.toggleIsolate(s.selectedId);
        showToast(store.get().isolatedId === s.selectedId ? `已隔离 ${p.zh}` : '已取消隔离');
      }
      break;
    case 'KeyH':
      if (s.selectedId !== null) {
        const p = partById(s.selectedId);
        store.toggleHidden(s.selectedId);
        showToast(store.get().hiddenIds.includes(s.selectedId) ? `已隐藏 ${p.zh}` : `已显示 ${p.zh}`);
      }
      break;
    case 'Escape':
      store.set({ selectedId: null });
      break;
    case 'Digit1':
      store.selectMode('assembly');
      break;
    case 'Digit2':
      store.selectMode('explode');
      break;
    case 'Digit3':
      store.selectMode('section');
      if (!store.get().clipEnabled) {
        store.set({ clipEnabled: true });
        scene.setClip(true, store.get().clipOffset);
      }
      break;
  }
});

// ---- 尺寸 / 移动端适配 ----
const mq = window.matchMedia('(max-width: 768px)');
// 移动端标签上限：CDP/headless 下 matchMedia matches 恒 false、resize/change 均不触发，
// 因此主循环每帧同步决策（仅决策变化时写 DOM，开销可忽略）。
let mobileLabelLimit: number | null = null;
const syncMobileLabels = (): void => {
  const limit = mq.matches || window.innerWidth <= 768 ? 8 : null;
  if (limit !== mobileLabelLimit) {
    mobileLabelLimit = limit;
    scene.labels.setMobileLimit(limit);
  }
};
mq.addEventListener('change', syncMobileLabels);

function onResize(): void {
  scene.resize(window.innerWidth, window.innerHeight);
  syncMobileLabels();
}
window.addEventListener('resize', onResize);
onResize();

const ro = new ResizeObserver(() => {
  const r = inspector.previewBox.getBoundingClientRect();
  preview.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
});
ro.observe(inspector.previewBox);

// ---- 主循环：每帧无条件应用 progress；标签页隐藏时暂停 rAF ----
const timer = new THREE.Timer();
let rafId = 0;
let running = false;
let fpsEma = 60;

function frame(): void {
  rafId = requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const elapsed = timer.getElapsed();
  syncMobileLabels();
  const s0 = store.get();
  if (s0.playing && !s0.dragging) store.tick(dt);
  const s = store.get();
  scene.applyProgress(s.progress); // 单一 progress 真相，无条件应用
  scene.update(dt, elapsed);
  preview.update(dt);
  scene.render();
  preview.render();
  fpsEma = fpsEma * 0.92 + (1 / Math.max(dt, 1e-4)) * 0.08;
  const azEl = scene.azEl();
  const info = scene.renderer.info.render;
  topbar.updateHud(azEl.az, azEl.el, Math.round(fpsEma), info.triangles, info.calls);
}

function startLoop(): void {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(frame);
}

function stopLoop(): void {
  running = false;
  cancelAnimationFrame(rafId);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
  else startLoop();
});
startLoop();

// ---- 调试 API（CDP 证据采集） ----
(window as unknown as { __TC__: unknown }).__TC__ = {
  setProgress: (p: number) => store.setProgress(clamp01(p)),
  selectPart: (id: number | null) => store.set({ selectedId: id }),
  explode: () => {
    store.selectMode('explode');
    store.setProgress(1);
  },
  assemble: () => store.selectMode('assembly'),
  toggleClip: () => toggleSectionView(),
  focus: (id: number) => scene.focusPart(id),
  iso: (id: number) => {
    const s = store.get();
    store.set({ isolatedId: s.isolatedId === id ? null : id });
  },
  hide: (id: number) => store.toggleHidden(id),
  showAll: () => store.showAll(),
  setAirflow: (on: boolean) => {
    store.set({ airflow: on });
    sceneActions.setAirflow(on);
  },
  setGlow: (on: boolean) => {
    store.set({ glow: on });
    sceneActions.setGlow(on);
  },
  snapshot: () => {
    const s = store.get();
    const info = scene.renderer.info.render;
    return {
      progress: Number(s.progress.toFixed(4)),
      mode: s.mode,
      playing: s.playing,
      reassembling: s.reassembling,
      clipEnabled: s.clipEnabled,
      clipOffset: s.clipOffset,
      selectedId: s.selectedId,
      isolatedId: s.isolatedId,
      hiddenIds: [...s.hiddenIds],
      visibleParts: PARTS.length - s.hiddenIds.length,
      scene: scene.debugState(),
      az: Number(scene.azEl().az.toFixed(1)),
      toggles: {
        labels: s.labelsVisible,
        clip: s.clipEnabled,
        glow: s.glow,
        dust: s.dust,
        airflow: s.airflow,
        focusFade: s.focusFade,
        shadows: s.shadows,
        autoRotate: s.autoRotate,
      },
      tris: info.triangles,
      calls: info.calls,
      fps: Math.round(fpsEma),
    };
  },
};

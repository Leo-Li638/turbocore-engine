// ============================================================================
// 顶栏：模式页签（装配/分解/剖切）、帮助弹窗（真实快捷键）、抽屉、HUD 状态胶囊
// ============================================================================
import { $, el } from './dom';
import { ENGINE_MODEL } from '../data/parts';
import { store, type AppState } from '../state/store';
import type { SceneActions } from './switches';
import type { Mode } from '../state/reducer';

export class TopBar {
  constructor(private actions: SceneActions) {
    $('#tb-model').textContent = ENGINE_MODEL;

    // 模式页签：只切状态机，不重建场景；剖切页签顺带开启剖切
    document.querySelectorAll<HTMLButtonElement>('#mode-tabs .mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode as Mode;
        store.selectMode(mode);
        if (mode === 'section' && !store.get().clipEnabled) {
          store.set({ clipEnabled: true });
          this.actions.setClip(true, store.get().clipOffset);
        }
      });
    });

    $('#btn-reset-view').addEventListener('click', () => this.actions.resetView());

    // 帮助弹窗
    const modal = $('#help-modal');
    const openHelp = (): void => modal.classList.remove('hidden');
    const closeHelp = (): void => modal.classList.add('hidden');
    $('#btn-help').addEventListener('click', openHelp);
    $('#btn-help-close').addEventListener('click', closeHelp);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHelp();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Escape' && !modal.classList.contains('hidden')) closeHelp();
    });

    // 移动端抽屉 + 遮罩
    const scrim = $('#drawer-scrim');
    const closeDrawers = (): void => {
      $('#left-panel').classList.remove('open');
      $('#right-panel').classList.remove('open');
      scrim.classList.add('hidden');
    };
    const toggleDrawer = (panelSel: string): void => {
      const panel = $(panelSel);
      const willOpen = !panel.classList.contains('open');
      closeDrawers();
      if (willOpen) {
        panel.classList.add('open');
        scrim.classList.remove('hidden');
      }
    };
    $('#btn-drawer-left').addEventListener('click', () => toggleDrawer('#left-panel'));
    $('#btn-drawer-right').addEventListener('click', () => toggleDrawer('#right-panel'));
    scrim.addEventListener('click', closeDrawers);

    this.fillHelp();
    store.subscribe((s) => this.render(s));
    this.render(store.get());
  }

  private fillHelp(): void {
    const rows: [string, string][] = [
      ['Space', '播放 / 暂停'],
      ['R', '重新装配'],
      ['V', '重置视角'],
      ['S', '本体剖切开关'],
      ['F', '聚焦选中部件'],
      ['I', '隔离 / 取消隔离'],
      ['H', '隐藏选中部件'],
      ['Esc', '取消选中'],
      ['1 / 2 / 3', '装配 / 分解 / 剖切'],
      ['左键拖拽', '旋转视角'],
      ['右键拖拽', '平移视角'],
      ['滚轮', '缩放视角'],
    ];
    const body = $('#help-body');
    body.replaceChildren();
    for (const [key, desc] of rows) {
      const hk = el('div', 'hk');
      hk.append(el('kbd', '', key), el('span', '', desc));
      body.appendChild(hk);
    }
  }

  /** HUD 方位角/俯仰角/FPS/三角面/DRAWCALL（由主循环每帧调用） */
  updateHud(az: number, elv: number, fps: number, tris: number, calls: number): void {
    $('#hud-az').textContent = `${az.toFixed(0)}°`;
    $('#hud-el').textContent = `${elv.toFixed(0)}°`;
    $('#hud-fps').textContent = String(fps);
    $('#hud-tris').textContent = tris >= 1000 ? `${(tris / 1000).toFixed(0)}K` : String(tris);
    $('#hud-calls').textContent = String(calls);
    $('#tb-fps').textContent = `${fps} FPS`;
  }

  private render(s: AppState): void {
    document.querySelectorAll<HTMLButtonElement>('#mode-tabs .mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === s.mode);
    });
    let en = 'ASSEMBLY';
    let zh = '完整装配状态';
    if (s.clipEnabled) {
      en = 'SECTION CUT';
      zh = '剖切视图';
    } else if (s.reassembling || s.playing) {
      en = 'TRANSITION';
      zh = s.reassembling ? '装配过渡中' : '分解过渡中';
    } else if (s.progress >= 1) {
      en = 'EXPLODED';
      zh = '完全分解状态';
    } else if (s.progress > 0) {
      en = 'EXPLODED';
      zh = `分解进度 ${Math.round(s.progress * 100)}%`;
    }
    $('#hud-status').textContent = en;
    $('#hud-status-zh').textContent = zh;
  }
}

// ============================================================================
// 8 个 DISPLAY CONTROL 开关 + 剖切平面滑块（开关只写 store + 通知场景）
// ============================================================================
import { $, el } from './dom';
import { store, type AppState } from '../state/store';

export interface SceneActions {
  setLabels(on: boolean): void;
  setClip(on: boolean, offset: number): void;
  setGlow(on: boolean): void;
  setDust(on: boolean): void;
  setAirflow(on: boolean): void;
  setShadows(on: boolean): void;
  setAutoRotate(on: boolean): void;
  resetView(): void;
}

interface SwitchDef {
  key: 'labelsVisible' | 'clipEnabled' | 'glow' | 'dust' | 'airflow' | 'focusFade' | 'shadows' | 'autoRotate';
  label: string;
  onChange?: (on: boolean) => void;
}

export class SwitchesPanel {
  private boxes = new Map<string, HTMLInputElement>();

  constructor(private actions: SceneActions) {
    const defs: SwitchDef[] = [
      { key: 'labelsVisible', label: '部件标注', onChange: (o) => actions.setLabels(o) },
      { key: 'clipEnabled', label: '整机剖切', onChange: (o) => actions.setClip(o, store.get().clipOffset) },
      { key: 'glow', label: '辉光效果', onChange: (o) => actions.setGlow(o) },
      { key: 'dust', label: '环境粒子', onChange: (o) => actions.setDust(o) },
      { key: 'airflow', label: '气流演示', onChange: (o) => actions.setAirflow(o) },
      { key: 'focusFade', label: '聚焦淡化' },
      { key: 'shadows', label: '实时阴影', onChange: (o) => actions.setShadows(o) },
      { key: 'autoRotate', label: '自动旋转', onChange: (o) => actions.setAutoRotate(o) },
    ];
    const host = $('#display-switches');
    for (const d of defs) {
      const row = el('div', 'switch-row');
      const label = el('label', '', d.label);
      // 关键修复：input 视觉隐藏时，必须让文字标签与滑块都能点击。
      // 做法：input 分配 id，label / .sw 均用 htmlFor 关联；.sw 改为 <label>，
      // 点击整块开关或文字都会触发原生 checkbox 切换并派发 change。
      const input = el('input');
      input.type = 'checkbox';
      input.id = `sw-${d.key}`;
      label.htmlFor = input.id;
      const sw = el('label', 'sw');
      sw.htmlFor = input.id;
      const knob = el('span', 'knob');
      sw.append(input, knob);
      row.append(label, sw);
      input.addEventListener('change', () => {
        store.set({ [d.key]: input.checked } as Partial<AppState>);
        d.onChange?.(input.checked);
      });
      host.appendChild(row);
      this.boxes.set(d.key, input);
    }

    // 剖切平面 Y 滑块（常驻显示：未开启剖切时置灰禁用，避免切换时面板上下跳动）
    const slider = $('#clip-slider') as HTMLInputElement;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      store.setClipOffset(v);
      if (store.get().clipEnabled) this.actions.setClip(true, v);
    });

    store.subscribe((s) => this.render(s));
    this.render(store.get());
  }

  private render(s: AppState): void {
    for (const [key, box] of this.boxes) {
      box.checked = (s as unknown as Record<string, unknown>)[key] === true;
    }
    const clipBox = $('#clip-slider-box');
    clipBox.classList.remove('hidden');
    clipBox.classList.toggle('off', !s.clipEnabled);
    const slider = $('#clip-slider') as HTMLInputElement;
    slider.disabled = !s.clipEnabled;
    if (document.activeElement !== slider) {
      slider.value = String(Math.round(s.clipOffset * 20) / 20);
    }
    $('#clip-val').textContent = `${s.clipOffset >= 0 ? '+' : ''}${s.clipOffset.toFixed(2)} m`;
  }
}

// ============================================================================
// 右侧部件检视：总览（SVG 剖面示意 + 6 项整机参数 + 分组芯片）
// / 选中（头部 + 3D 迷你预览 + 功能/结构/几何 + 关键参数 + 操作按钮）
// ============================================================================
import { $, el, svgEl } from './dom';
import {
  ENGINE_BLURB, ENGINE_MODEL, ENGINE_SPECS, GROUPS, PARTS, ZONE_COLORS,
  padId, partById, partsOfGroup, type PartDef,
} from '../data/parts';
import { store, type AppState } from '../state/store';
import { showToast } from './toast';

export interface InspectorEvents {
  onSelectPart(id: number): void;
  onFocus(id: number): void;
  onBack(): void;
}

export class InspectorPanel {
  /** 迷你 3D 预览画布（由 PreviewScene 驱动，切换选中时重新挂载） */
  readonly previewCanvas: HTMLCanvasElement;
  readonly previewBox: HTMLElement;
  private scroll = $('#inspector-scroll');
  private overviewEl: HTMLElement | null = null;

  constructor(private events: InspectorEvents) {
    this.previewCanvas = document.createElement('canvas');
    this.previewBox = el('div', 'preview-box');
    this.previewBox.appendChild(this.previewCanvas);
    this.previewBox.appendChild(el('div', 'pv-tip', '自动旋转预览'));
    store.subscribe((s) => this.render(s));
    this.render(store.get());
  }

  private render(s: AppState): void {
    if (s.selectedId === null) {
      $('#inspector-id').textContent = 'OVERVIEW';
      this.renderOverview();
    } else {
      const p = partById(s.selectedId);
      $('#inspector-id').textContent = padId(p.id);
      this.renderSelected(s, p);
    }
  }

  private renderOverview(): void {
    if (this.overviewEl) {
      this.scroll.replaceChildren(this.overviewEl);
      return;
    }
    const wrap = el('div');
    wrap.appendChild(el('div', 'ov-title', ENGINE_MODEL));
    wrap.appendChild(el('div', 'ov-sub', ENGINE_BLURB));
    wrap.appendChild(this.buildSchematic());

    const grid = el('div', 'spec-grid');
    for (const sp of ENGINE_SPECS) {
      const card = el('div', 'spec-card');
      card.appendChild(el('div', 'v', sp.v));
      card.appendChild(el('div', 'k', `${sp.k}${sp.unit ? ` · ${sp.unit}` : ''}`));
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    const og = el('div', 'ov-groups');
    og.appendChild(el('div', 'g-title', '部件分组 · 点击进入该组首个部件'));
    const chips = el('div', 'group-chips');
    for (const g of GROUPS) {
      const chip = el('span', 'group-chip');
      const dot = el('i');
      dot.style.background = ZONE_COLORS[g.zone];
      chip.append(dot, document.createTextNode(`${g.id} ${g.zh}`));
      chip.addEventListener('click', () => this.events.onSelectPart(partsOfGroup(g.id)[0].id));
      chips.appendChild(chip);
    }
    og.appendChild(chips);
    wrap.appendChild(og);
    this.overviewEl = wrap;
    this.scroll.replaceChildren(wrap);
  }

  /** 剖面示意图：沿纵轴（左进气 → 右排气），分区着色 */
  private buildSchematic(): SVGSVGElement {
    const svg = svgEl('svg', {
      viewBox: '0 0 320 92', class: 'ov-svg', role: 'img',
      'aria-label': '涡扇发动机剖面示意图（进气/风扇/压气机/燃烧室/涡轮/尾喷管）',
    });
    svg.appendChild(svgEl('line', {
      x1: '8', y1: '46', x2: '312', y2: '46', stroke: '#6E8095',
      'stroke-width': '1', 'stroke-dasharray': '3 3', opacity: '.6',
    }));
    const sections: [string, string][] = [
      ['8,14 86,14 86,78 8,78', '#4DA8FF'],    // 进气机匣
      ['72,30 80,30 80,62 72,62', '#4DA8FF'],  // 风扇
      ['86,34 150,28 150,64 86,58', '#2FE7D5'], // 压气机（向尾收窄）
      ['150,30 186,30 186,62 150,62', '#FF8A2B'], // 燃烧室
      ['186,28 238,38 238,54 186,64', '#FF4A26'], // 涡轮
      ['238,38 312,45 312,47 238,54', '#FF4A26'], // 尾喷管
    ];
    for (const [pts, color] of sections) {
      svg.appendChild(svgEl('polygon', {
        points: pts, fill: color, 'fill-opacity': '.14',
        stroke: color, 'stroke-width': '1.2',
      }));
    }
    const solids: [string, string][] = [
      ['8,46 34,40 34,52', '#C7CFD8'],   // 整流锥
      ['158,38 178,38 178,54 158,54', '#FF5A1F'], // 火焰筒核心
    ];
    for (const [pts, color] of solids) {
      svg.appendChild(svgEl('polygon', {
        points: pts, fill: color, 'fill-opacity': '.8',
        stroke: color, 'stroke-width': '.8',
      }));
    }
    const labels: [number, number, string][] = [
      [34, 10, '进气'], [76, 88, '风扇'], [118, 10, '压气机'],
      [168, 10, '燃烧室'], [210, 10, '涡轮'], [272, 10, '尾喷管'],
    ];
    for (const [x, y, text] of labels) {
      const t = svgEl('text', {
        x: String(x), y: String(y), 'font-size': '8', fill: '#6E8095',
        'text-anchor': 'middle', 'font-family': 'sans-serif',
      });
      t.textContent = text;
      svg.appendChild(t);
    }
    return svg;
  }

  private renderSelected(s: AppState, p: PartDef): void {
    const wrap = el('div');
    const head = el('div', 'insp-head');
    head.appendChild(el('div', 'insp-id', padId(p.id)));
    head.appendChild(el('div', 'p-zh', p.zh));
    head.appendChild(el('div', 'p-en', p.en));
    wrap.appendChild(head);
    wrap.appendChild(this.previewBox);

    wrap.appendChild(this.section('功能', p.funcDesc));
    wrap.appendChild(this.section('结构', p.structDesc));
    wrap.appendChild(this.section('几何', p.geometryDesc));

    const sec = el('div', 'insp-sec');
    sec.appendChild(el('div', 's-title', '关键参数'));
    const mg = el('div', 'metric-grid');
    for (const m of p.metrics) {
      const card = el('div', 'metric-card');
      card.appendChild(el('div', 'v', m.v));
      card.appendChild(el('div', 'k', m.k));
      mg.appendChild(card);
    }
    sec.appendChild(mg);
    wrap.appendChild(sec);

    const acts = el('div', 'insp-actions');
    const focus = el('button', 'action-btn', '聚焦');
    focus.addEventListener('click', () => this.events.onFocus(p.id));
    const iso = el('button', 'action-btn', s.isolatedId === p.id ? '取消隔离' : '隔离');
    iso.addEventListener('click', () => {
      store.toggleIsolate(p.id);
      showToast(store.get().isolatedId === p.id ? `已隔离 ${p.zh}` : '已取消隔离');
    });
    const hide = el('button', 'action-btn', s.hiddenIds.includes(p.id) ? '显示' : '隐藏');
    hide.addEventListener('click', () => {
      store.toggleHidden(p.id);
      showToast(store.get().hiddenIds.includes(p.id) ? `已隐藏 ${p.zh}` : `已显示 ${p.zh}`);
    });
    const showAllBtn = el('button', 'action-btn', '显示全部');
    showAllBtn.addEventListener('click', () => {
      store.showAll();
      showToast(`已显示全部 ${PARTS.length} 个部件`);
    });
    const back = el('button', 'action-btn', '返回总览');
    back.addEventListener('click', () => this.events.onBack());
    acts.append(focus, iso, hide, showAllBtn, back);
    wrap.appendChild(acts);
    this.scroll.replaceChildren(wrap);
  }

  private section(title: string, text: string): HTMLElement {
    const sec = el('div', 'insp-sec');
    sec.appendChild(el('div', 's-title', title));
    sec.appendChild(el('div', 's-text', text));
    return sec;
  }
}

// ============================================================================
// 左侧部件结构树：6 组可折叠、搜索、eye 显隐、计数
// ============================================================================
import { GROUPS, PARTS, padId, partsOfGroup, type GroupId } from '../data/parts';
import { store, type AppState } from '../state/store';
import { $, el } from './dom';
import { showToast } from './toast';

export interface TreeEvents {
  onSelectPart(id: number): void;
}

export class TreePanel {
  private host = $('#tree-groups');
  private rows = new Map<number, HTMLElement>();
  private eyes = new Map<number, HTMLButtonElement>();
  private collapsed = new Set<string>();
  private query = '';

  constructor(private events: TreeEvents) {
    this.build();
    this.bindSearch();
    $('#btn-show-all').addEventListener('click', () => {
      store.showAll();
      showToast(`已显示全部 ${PARTS.length} 个部件`);
    });
    store.subscribe((s) => this.render(s));
    this.render(store.get());
  }

  private build(): void {
    this.host.replaceChildren();
    for (const g of GROUPS) {
      const groupEl = el('div', 'tree-group');
      groupEl.dataset.group = g.id;
      const head = el('div', 'tree-group-head');
      const caret = el('span', 'caret', '▸');
      const name = el('span', '', `${g.id} · ${g.zh}`);
      const en = el('span', 'g-en', g.en);
      const count = el('span', 'g-count', String(partsOfGroup(g.id).length));
      head.append(caret, name, en, count);
      head.addEventListener('click', () => this.toggleGroup(g.id));
      const rowsEl = el('div', 'tree-rows');
      for (const p of partsOfGroup(g.id)) {
        const row = el('div', 'tree-row');
        row.dataset.id = String(p.id);
        const idSpan = el('span', 'row-id', padId(p.id));
        const zh = el('span', 'row-zh', p.zh);
        const enSpan = el('span', 'row-en', p.en);
        const eye = el('button', 'eye', '👁');
        eye.title = '隐藏 / 显示';
        eye.addEventListener('click', (ev) => {
          ev.stopPropagation();
          store.toggleHidden(p.id);
        });
        row.append(idSpan, zh, enSpan, eye);
        row.addEventListener('click', () => this.events.onSelectPart(p.id));
        rowsEl.appendChild(row);
        this.rows.set(p.id, row);
        this.eyes.set(p.id, eye);
      }
      groupEl.append(head, rowsEl);
      this.host.appendChild(groupEl);
    }
  }

  private toggleGroup(id: string): void {
    const groupEl = this.host.querySelector<HTMLElement>(`[data-group="${id}"]`);
    if (!groupEl) return;
    if (this.collapsed.has(id)) {
      this.collapsed.delete(id);
      groupEl.classList.remove('collapsed');
    } else {
      this.collapsed.add(id);
      groupEl.classList.add('collapsed');
    }
  }

  private bindSearch(): void {
    const input = $('#tree-search') as HTMLInputElement;
    input.addEventListener('input', () => {
      this.query = input.value.trim().toLowerCase();
      this.applyFilter();
    });
  }

  private applyFilter(): void {
    const hits = new Set<number>();
    for (const p of PARTS) {
      const hay = `${padId(p.id)} ${p.zh} ${p.en}`.toLowerCase();
      if (this.query === '' || hay.includes(this.query)) hits.add(p.id);
    }
    for (const [id, row] of this.rows) {
      row.style.display = hits.has(id) ? '' : 'none';
    }
    this.host.querySelectorAll<HTMLElement>('.tree-group').forEach((groupEl) => {
      const gid = groupEl.dataset.group as GroupId;
      if (this.query !== '') {
        const anyHit = partsOfGroup(gid).some((p) => hits.has(p.id));
        groupEl.classList.toggle('collapsed', !anyHit);
      } else {
        groupEl.classList.toggle('collapsed', this.collapsed.has(gid));
      }
    });
  }

  private render(s: AppState): void {
    for (const [id, row] of this.rows) row.classList.toggle('selected', s.selectedId === id);
    for (const [id, eye] of this.eyes) eye.classList.toggle('off', s.hiddenIds.includes(id));
    const visible = PARTS.length - s.hiddenIds.length;
    $('#visible-count').textContent = `${visible}/${PARTS.length}`;
    $('#tree-count').textContent = String(PARTS.length);
  }
}

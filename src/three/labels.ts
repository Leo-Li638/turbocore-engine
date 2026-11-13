// ============================================================================
// CSS2D 部件标注层：每个零件一个悬浮标签（挂在零件 group 上，随爆炸移动）
// ============================================================================
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PARTS, padId } from '../data/parts';
import type { PartNode } from './PartFactory';

export class LabelLayer {
  renderer: CSS2DRenderer;
  private labels = new Map<number, CSS2DObject>();
  private host: HTMLElement;
  private on = true;
  private mobileLimit: number | null = null;

  constructor(host: HTMLElement, nodes: Map<number, PartNode>) {
    this.host = host;
    this.renderer = new CSS2DRenderer();
    this.renderer.domElement.classList.add('tc-label-layer');
    host.appendChild(this.renderer.domElement);
    for (const p of PARTS) {
      const node = nodes.get(p.id)!;
      const el = document.createElement('div');
      el.className = p.zone === 'combustor' ? 'tc-label warm' : 'tc-label';
      el.dataset.partId = String(p.id);
      el.innerHTML =
        `<span class="lb-id">${padId(p.id)}</span><span class="lb-zh">${p.zh}</span><span class="lb-en">${p.en}</span>`;
      const obj = new CSS2DObject(el);
      obj.position.copy(node.labelAnchor);
      obj.userData.partId = p.id;
      node.group.add(obj);
      this.labels.set(p.id, obj);
    }
  }

  setVisible(on: boolean): void {
    this.on = on;
    this.renderer.domElement.style.display = on ? '' : 'none';
  }

  /** 移动端限制标签数（≤8），按零件编号优先级 */
  setMobileLimit(limit: number | null): void {
    this.mobileLimit = limit;
    this.applyLimit();
  }

  private applyLimit(): void {
    // 注意：不能直接写 element.style.display —— CSS2DRenderer 每帧渲染会按
    // object.visible 重写 display（renderObject 第 243 行），必须改 object.visible。
    for (const [id, obj] of this.labels) {
      obj.visible = this.mobileLimit === null || id <= this.mobileLimit;
    }
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.on) this.renderer.render(scene, camera);
  }

  dispose(): void {
    for (const obj of this.labels.values()) obj.element.remove();
    this.host.removeChild(this.renderer.domElement);
  }
}

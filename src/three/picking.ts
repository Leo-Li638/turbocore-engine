// ============================================================================
// 拾取：hover 光标+高亮；点击选中（区分拖动）；只拾取可见零件。
// ============================================================================
import * as THREE from 'three';

export interface PickerCallbacks {
  onHover(id: number | null): void;
  onSelect(id: number): void;
}

export class Picker {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hoverId: number | null = null;
  private downPos: { x: number; y: number } | null = null;
  private moved = false;
  private cb: PickerCallbacks;
  private dom: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private getPickables: () => THREE.Object3D[];

  constructor(
    dom: HTMLElement,
    camera: THREE.PerspectiveCamera,
    getPickables: () => THREE.Object3D[],
    cb: PickerCallbacks,
  ) {
    this.dom = dom;
    this.camera = camera;
    this.getPickables = getPickables;
    this.cb = cb;
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointerleave', this.onLeave);
  }

  private onMove = (e: PointerEvent): void => {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (this.downPos && Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > 6) {
      this.moved = true;
    }
    this.updateHover();
  };

  private onDown = (e: PointerEvent): void => {
    this.downPos = { x: e.clientX, y: e.clientY };
    this.moved = false;
  };

  private onUp = (): void => {
    if (this.downPos && !this.moved) {
      const id = this.pick();
      if (id !== null) this.cb.onSelect(id);
    }
    this.downPos = null;
  };

  private onLeave = (): void => {
    this.setHover(null);
  };

  private pick(): number | null {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.getPickables(), false);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const pid = o.userData.partId;
        if (typeof pid === 'number') return pid as number;
        o = o.parent;
      }
    }
    return null;
  }

  updateHover(): void {
    this.setHover(this.pick());
  }

  private setHover(id: number | null): void {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.dom.style.cursor = id === null ? '' : 'pointer';
    this.cb.onHover(id);
  }

  dispose(): void {
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointerleave', this.onLeave);
  }
}

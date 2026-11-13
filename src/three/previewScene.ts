// ============================================================================
// 右面板选中零件的迷你 3D 预览：第二渲染器 + 克隆节点 + 自动旋转。
// 克隆共享几何/材质引用（只读展示，绝不 dispose 主场景资源）。
// ============================================================================
import * as THREE from 'three';
import type { PartNode } from './PartFactory';

export class PreviewScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private group: THREE.Group | null = null;
  private target = new THREE.Vector3();
  private radius = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 20);
    this.scene.add(new THREE.AmbientLight(0x556677, 1.6));
    const cyan = new THREE.DirectionalLight(0x39e6ff, 2.4);
    cyan.position.set(-2, 1.5, -2);
    this.scene.add(cyan);
    const orange = new THREE.DirectionalLight(0xff8a2b, 1.8);
    orange.position.set(2, -1, 2);
    this.scene.add(orange);
  }

  setPart(node: PartNode): void {
    if (this.group) this.scene.remove(this.group);
    this.group = node.group.clone(true) as THREE.Group;
    // clone(true) 共享材质引用：主场景 applySelection 改 opacity/高亮会漏进预览，这里克隆材质隔离
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
      const mat = m.material as THREE.Material;
      if (mat === node.mats.solid) m.material = mat.clone();
      else if (node.mats.ghost && mat === node.mats.ghost) m.material = mat.clone();
    });
    this.scene.add(this.group);
    const c = node.bbox.min.clone().add(node.bbox.max).multiplyScalar(0.5);
    const ext = node.bbox.max.clone().sub(node.bbox.min);
    this.target.copy(c);
    this.radius = Math.max(ext.length() * 0.62, 0.9);
    this.camera.position.set(this.radius * 1.25, this.radius * 0.5, this.radius * 1.25);
    this.camera.lookAt(this.target);
    this.camera.near = Math.max(0.02, this.radius * 0.02);
    this.camera.far = this.radius * 8 + 4;
    this.camera.updateProjectionMatrix();
  }

  clear(): void {
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
    }
  }

  update(dt: number): void {
    if (this.group) this.group.rotation.y += dt * 0.55;
  }

  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.dispose();
  }
}

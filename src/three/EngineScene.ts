// ============================================================================
// 主场景：背景/雾/灯光/全息平台/剖切/辉光/飞行聚焦 + 每帧 applyProgress。
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PARTS } from '../data/parts';
import { computeAllPositions, makePose, easeInOutCubic } from './explode';
import { PartFactory, applyGhostMode, type PartNode } from './PartFactory';
import { AirflowLayer } from './airflow';
import { LabelLayer } from './labels';

const PLATFORM_Y = -2.7;

export class EngineScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  nodes: Map<number, PartNode>;
  poses = PARTS.map((p) => makePose(p.id, [0, 0, 0], p.explodeOffset));
  private positions = new Map<number, [number, number, number]>();
  private clipMaterials: THREE.Material[] = [];
  clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.15);
  private clipGizmo: THREE.Group;
  airflow: AirflowLayer;
  labels: LabelLayer;
  private dust: THREE.Points;
  private dirLight: THREE.DirectionalLight;
  private glowOn: boolean;
  private flight: {
    t: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3;
    fromTgt: THREE.Vector3; toTgt: THREE.Vector3;
  } | null = null;

  constructor(host: HTMLElement, labelHost: HTMLElement, opts: { airflowCount?: number } = {}) {
    this.scene = new THREE.Scene();
    this.scene.name = 'turbocore';

    // ---- 背景：径向渐变球（#0A1626 中心 → #030810 边缘）+ 雾 ----
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 256; bgCanvas.height = 256;
    const ctx = bgCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 200);
    grad.addColorStop(0, '#0A1626');
    grad.addColorStop(1, '#030810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    const bgSphere = new THREE.Mesh(
      new THREE.SphereGeometry(45, 32, 32),
      new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    bgSphere.name = 'background';
    this.scene.add(bgSphere);
    this.scene.fog = new THREE.Fog(0x030810, 13, 40);

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    // ---- 相机 ----
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 70);
    this.camera.position.set(7.4, 2.8, 7.4);

    // ---- 控制器 ----
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.autoRotateSpeed = 0.8;

    // ---- 灯光 ----
    this.scene.add(new THREE.AmbientLight(0x334455, 1.4));
    this.dirLight = new THREE.DirectionalLight(0xeef4ff, 2.4);
    this.dirLight.position.set(6, 10, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 40;
    this.dirLight.shadow.camera.left = -8;
    this.dirLight.shadow.camera.right = 8;
    this.dirLight.shadow.camera.top = 8;
    this.dirLight.shadow.camera.bottom = -8;
    this.dirLight.shadow.bias = -0.0006;
    this.scene.add(this.dirLight);
    const cyan = new THREE.DirectionalLight(0x39e6ff, 2.6);
    cyan.position.set(-5, 1.2, -4);
    this.scene.add(cyan);
    const orange = new THREE.DirectionalLight(0xff8a2b, 2.0);
    orange.position.set(5, -1, 4);
    this.scene.add(orange);
    const core = new THREE.PointLight(0xff5a1f, 30, 6, 2);
    core.position.set(0, 0.05, 0);
    core.name = 'core-light';
    this.scene.add(core);

    // ---- 零件 ----
    const factory = new PartFactory();
    this.nodes = factory.buildAll();
    for (const n of this.nodes.values()) {
      this.scene.add(n.group);
      this.clipMaterials.push(n.mats.solid);
      if (n.mats.ghost) this.clipMaterials.push(n.mats.ghost);
    }
    this.applyProgress(0);

    // ---- 全息平台 ----
    this.scene.add(this.buildPlatform());

    // ---- 剖切指示器 ----
    this.clipGizmo = new THREE.Group();
    const gizmoRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x39e6ff, transparent: true, opacity: 0.9 }),
    );
    gizmoRing.rotation.x = Math.PI / 2;
    const gizmoPlane = new THREE.Mesh(
      new THREE.CircleGeometry(1.06, 48),
      new THREE.MeshBasicMaterial({ color: 0x39e6ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    gizmoPlane.rotation.x = Math.PI / 2;
    this.clipGizmo.add(gizmoRing, gizmoPlane);
    this.clipGizmo.visible = false;
    this.scene.add(this.clipGizmo);

    // ---- 环境尘埃 ----
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      const r = 2 + Math.random() * 4.5;
      const phi = Math.random() * Math.PI * 2;
      const y = -3 + Math.random() * 6;
      dustPos[i * 3] = Math.cos(phi) * r;
      dustPos[i * 3 + 1] = y;
      dustPos[i * 3 + 2] = Math.sin(phi) * r;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0x6fb8ff, size: 0.05, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.dust.name = 'dust';
    this.scene.add(this.dust);

    // ---- 气流层 / 标签层 ----
    this.airflow = new AirflowLayer(opts.airflowCount ?? 1200);
    this.scene.add(this.airflow.group);
    this.labels = new LabelLayer(labelHost, this.nodes);

    // ---- 辉光后处理 ----
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.5, 0.45, 0.82);
    this.composer.addPass(this.bloomPass);
    this.glowOn = true;

    // 初始标注默认显示
    this.labels.setVisible(true);
  }

  private buildPlatform(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'platform';
    g.position.y = PLATFORM_Y;
    const addRing = (rIn: number, rOut: number, color: number, opacity: number) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rOut, 64),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      g.add(m);
    };
    addRing(2.15, 2.55, 0x39e6ff, 0.55); // 主辉光环
    addRing(2.9, 2.95, 0x39e6ff, 0.22);
    addRing(3.5, 3.54, 0x39e6ff, 0.16);
    addRing(1.1, 1.14, 0x39e6ff, 0.2);
    // 网格
    const grid = new THREE.GridHelper(11, 44, 0x39e6ff, 0x0e2a3d);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    grid.position.y = 0.01;
    g.add(grid);
    // 底盘
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 64),
      new THREE.MeshStandardMaterial({ color: 0x04101c, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.92 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.01;
    base.receiveShadow = true;
    g.add(base);
    // 地平线辉光 sprite
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256; glowCanvas.height = 64;
    const ctx = glowCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 32, 4, 128, 32, 128);
    grad.addColorStop(0, 'rgba(57,230,255,0.55)');
    grad.addColorStop(1, 'rgba(57,230,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 64);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.set(11, 2.75, 1);
    sprite.position.y = 0.15;
    g.add(sprite);
    return g;
  }

  /** 每帧无条件应用：单一 progress 真相 */
  applyProgress(progress: number): void {
    this.positions = computeAllPositions(this.poses, progress);
    for (const [id, pos] of this.positions) {
      const node = this.nodes.get(id);
      if (node) node.group.position.set(pos[0], pos[1], pos[2]);
    }
  }

  getPosition(id: number): [number, number, number] {
    return this.positions.get(id) ?? [0, 0, 0];
  }

  /** 剖切：plane 常数 = offset（默认 +0.15，保留 y ≤ offset 后部内部） */
  setClip(on: boolean, offset: number): void {
    this.clipPlane.constant = offset;
    this.clipGizmo.visible = on;
    this.clipGizmo.position.y = offset;
    const planes = on ? [this.clipPlane] : [];
    for (const m of this.clipMaterials) m.clippingPlanes = planes;
    for (const n of this.nodes.values()) applyGhostMode(n, on);
  }

  setShadows(on: boolean): void {
    this.dirLight.castShadow = on;
  }

  setGlow(on: boolean): void {
    this.glowOn = on;
    this.bloomPass.enabled = on;
  }

  setDust(on: boolean): void {
    this.dust.visible = on;
  }

  setLabels(on: boolean): void {
    this.labels.setVisible(on);
  }

  setAirflow(on: boolean): void {
    this.airflow.setVisible(on);
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
  }

  /** 调试：真实场景开关状态（CDP 断言用，验证 UI 点击真的作用到场景上） */
  debugState(): Record<string, boolean | number> {
    return {
      labels: this.labels.renderer.domElement.style.display !== 'none',
      glow: this.glowOn,
      dust: this.dust.visible,
      airflow: this.airflow.group.visible,
      shadows: this.dirLight.castShadow,
      clip: this.clipGizmo.visible,
      clipOffset: this.clipPlane.constant,
      autoRotate: this.controls.autoRotate,
    };
  }

  /** 拾取候选：可见零件（隐藏/完全透明不参与） */
  pickableList(hiddenIds: number[]): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const [id, n] of this.nodes) {
      if (hiddenIds.includes(id)) continue;
      out.push(...n.pickables);
    }
    return out;
  }

  resetView(animate = true): void {
    if (animate) {
      this.flyTo(new THREE.Vector3(7.4, 2.8, 7.4), new THREE.Vector3(0, 0, 0));
    } else {
      this.camera.position.set(7.4, 2.8, 7.4);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  /** 聚焦某零件：相机飞到包围盒前方 */
  focusPart(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    const gp = node.group.position;
    const c = node.bbox.min.clone().add(node.bbox.max).multiplyScalar(0.5).add(gp);
    const ext = node.bbox.max.clone().sub(node.bbox.min);
    const dist = Math.max(ext.length() * 1.15 + 0.9, 2.2);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const toPos = c.clone().add(dir.multiplyScalar(dist));
    this.flyTo(toPos, c);
  }

  flyTo(pos: THREE.Vector3, tgt: THREE.Vector3, dur = 0.65): void {
    this.flight = {
      t: 0, dur,
      fromPos: this.camera.position.clone(), toPos: pos.clone(),
      fromTgt: this.controls.target.clone(), toTgt: tgt.clone(),
    };
  }

  update(dt: number, elapsed: number): void {
    if (this.flight) {
      this.flight.t += dt;
      const k = easeInOutCubic(Math.min(1, this.flight.t / this.flight.dur));
      this.camera.position.lerpVectors(this.flight.fromPos, this.flight.toPos, k);
      this.controls.target.lerpVectors(this.flight.fromTgt, this.flight.toTgt, k);
      if (this.flight.t >= this.flight.dur) this.flight = null;
    }
    this.controls.update();
    if (this.dust.visible) this.dust.rotation.y += dt * 0.02;
    this.airflow.update(dt, elapsed);
  }

  render(): void {
    if (this.glowOn) {
      // EffectComposer 内部多次 renderer.render()，每次都会因 autoReset 清空 info；
      // 关掉 autoReset 手动 reset，渲染结束后 info 即为整帧（主场景 + 后期）的累计统计。
      this.renderer.info.autoReset = false;
      this.renderer.info.reset();
      this.composer.render();
      this.renderer.info.autoReset = true;
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.labels.render(this.scene, this.camera);
  }

  /** HUD 方位角/俯仰角（度） */
  azEl(): { az: number; el: number } {
    const p = this.camera.position.clone().sub(this.controls.target);
    const az = ((Math.atan2(p.x, p.z) * 180) / Math.PI + 360) % 360;
    const el = (Math.asin(THREE.MathUtils.clamp(p.y / p.length(), -1, 1)) * 180) / Math.PI;
    return { az, el };
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.resize(w, h);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.airflow.dispose();
    this.labels.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

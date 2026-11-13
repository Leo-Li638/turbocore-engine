// ============================================================================
// 气流演示层：四区着色点云（进气压/燃烧/排气）+ 锥形箭头 InstancedMesh。
// 独立 Group、独立材质（不参与剖切裁剪、不参与拾取），不影响零件位姿。
// ============================================================================
import * as THREE from 'three';

interface ZoneSpec {
  y0: number; y1: number; r0: number; r1: number;
  color: string; speed: number; frac: number;
}

const ZONES: ZoneSpec[] = [
  { y0: 1.95, y1: 2.28, r0: 0.1, r1: 0.95, color: '#4DA8FF', speed: 0.55, frac: 0.28 },
  { y0: 0.22, y1: 1.55, r0: 0.08, r1: 0.52, color: '#2FE7D5', speed: 0.8, frac: 0.34 },
  { y0: -0.38, y1: 0.28, r0: 0.26, r1: 0.48, color: '#FF8A2B', speed: 0.4, frac: 0.16 },
  { y0: -2.2, y1: -0.45, r0: 0.06, r1: 0.42, color: '#FF4A26', speed: 1.05, frac: 0.22 },
];

export class AirflowLayer {
  group = new THREE.Group();
  private points!: THREE.Points;
  private posAttr!: THREE.BufferAttribute;
  private speeds!: Float32Array;
  private zoneOf!: Int32Array;
  private cones!: THREE.InstancedMesh;
  private coneY!: Float32Array;
  private conePhase!: Float32Array;
  private coneBase!: Float32Array; // 每锥基准缩放
  private count: number;

  constructor(count = 1200) {
    this.count = count;
    this.group.name = 'airflow';
    this.group.userData.noPick = true;

    // ---- 点云 ----
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    this.zoneOf = new Int32Array(count);
    const c = new THREE.Color();
    let i = 0;
    for (let z = 0; z < ZONES.length; z++) {
      const zn = ZONES[z];
      const n = Math.max(1, Math.round(count * zn.frac));
      for (let k = 0; k < n && i < count; k++, i++) {
        const r = zn.r0 + Math.random() * (zn.r1 - zn.r0);
        const phi = Math.random() * Math.PI * 2;
        const y = zn.y0 + Math.random() * (zn.y1 - zn.y0);
        positions[i * 3] = Math.cos(phi) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(phi) * r;
        c.set(zn.color);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        this.speeds[i] = zn.speed;
        this.zoneOf[i] = z;
      }
    }
    for (; i < count; i++) {
      const zn = ZONES[3];
      const r = zn.r0 + Math.random() * (zn.r1 - zn.r0);
      const phi = Math.random() * Math.PI * 2;
      const y = zn.y0 + Math.random() * (zn.y1 - zn.y0);
      positions[i * 3] = Math.cos(phi) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(phi) * r;
      c.set(zn.color);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      this.speeds[i] = zn.speed;
      this.zoneOf[i] = 3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const mat = new THREE.PointsMaterial({
      size: 0.045, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.userData.noPick = true;
    this.group.add(this.points);

    // ---- 锥形箭头（20 个，按区着色）----
    const coneCount = 20;
    const coneGeo = new THREE.ConeGeometry(0.05, 0.17, 6);
    coneGeo.rotateX(Math.PI); // 尖端朝 -Y（气流向后）
    const coneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false });
    this.cones = new THREE.InstancedMesh(coneGeo, coneMat, coneCount);
    this.coneY = new Float32Array(coneCount);
    this.conePhase = new Float32Array(coneCount);
    this.coneBase = new Float32Array(coneCount);
    const dummy = new THREE.Object3D();
    const zoneColor = new THREE.Color();
    for (let k = 0; k < coneCount; k++) {
      const zn = ZONES[k % ZONES.length];
      const phi = ((k * 2.399) % (Math.PI * 2));
      const r = zn.r0 + ((zn.r1 - zn.r0) * ((k % 5) + 0.5)) / 5;
      this.coneY[k] = zn.y0 + ((zn.y1 - zn.y0) * (k % 4)) / 3.999;
      this.conePhase[k] = Math.random() * Math.PI * 2;
      this.coneBase[k] = 0.85 + Math.random() * 0.3;
      dummy.position.set(Math.cos(phi) * r, this.coneY[k], Math.sin(phi) * r);
      dummy.updateMatrix();
      this.cones.setMatrixAt(k, dummy.matrix);
      zoneColor.set(zn.color);
      this.cones.setColorAt(k, zoneColor);
    }
    this.cones.instanceMatrix.needsUpdate = true;
    if (this.cones.instanceColor) this.cones.instanceColor.needsUpdate = true;
    this.cones.userData.noPick = true;
    this.group.add(this.cones);
  }

  setVisible(on: boolean): void {
    this.group.visible = on;
  }

  update(dt: number, elapsed: number): void {
    const pos = this.posAttr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const z = this.zoneOf[i];
      const zn = ZONES[z];
      let y = pos[i * 3 + 1] - this.speeds[i] * dt;
      if (y < zn.y0) y = zn.y1 - (zn.y0 - y);
      pos[i * 3 + 1] = y;
    }
    this.posAttr.needsUpdate = true;

    const dummy = new THREE.Object3D();
    for (let k = 0; k < this.cones.count; k++) {
      const zn = ZONES[k % ZONES.length];
      let y = this.coneY[k] - zn.speed * dt;
      if (y < zn.y0) y = zn.y1 - (zn.y0 - y);
      this.coneY[k] = y;
      this.cones.getMatrixAt(k, dummy.matrix);
      dummy.position.setY(y);
      const s = this.coneBase[k] * (1 + 0.14 * Math.sin(elapsed * 2.6 + this.conePhase[k]));
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.cones.setMatrixAt(k, dummy.matrix);
    }
    this.cones.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.cones.geometry.dispose();
    (this.cones.material as THREE.Material).dispose();
  }
}

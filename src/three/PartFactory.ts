// ============================================================================
// 网格工厂：按 solids.ts 的几何常量（单一来源）构建 24 个零件的可视化网格。
// 规则：重复结构一律 InstancedMesh；回转体用 LatheGeometry（真实壁厚）；
// 所有网格 userData.partId 供拾取，group 位移由 explode.ts 每帧驱动。
// ============================================================================
import * as THREE from 'three';
import type { PartDef } from '../data/parts';
import { PARTS } from '../data/parts';
import { GEOM, solidsOfPart, type BladeSpec } from './solids';
import { makePartMaterials, type PartMaterials } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PartNode {
  id: number;
  group: THREE.Group;
  mats: PartMaterials;
  /** 拾取目标（含 InstancedMesh） */
  pickables: THREE.Object3D[];
  /** CSS2D 标签挂点（零件局部坐标，随 group 爆炸移动） */
  labelAnchor: THREE.Vector3;
  /** 装配位姿解析包围盒 */
  bbox: { min: THREE.Vector3; max: THREE.Vector3 };
}

const SEG = 48;

/** 封闭轮廓回转 → 实心环带（真实壁厚，匹配碰撞 annulus） */
function latheRing(y0: number, y1: number, rIn: number, rOut: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(rIn, y0), new THREE.Vector2(rOut, y0),
    new THREE.Vector2(rOut, y1), new THREE.Vector2(rIn, y1),
  ];
  const g = new THREE.LatheGeometry(pts, SEG);
  g.rotateX(Math.PI / 2); // Lathe 默认绕 Y 生成在 XZ 平面，旋转使 Y 为高度轴
  return g;
}

/** 带内孔圆盘（匹配碰撞 disc） */
function latheDisc(y: number, half: number, rIn: number, rOut: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(rIn, y - half), new THREE.Vector2(rOut, y - half),
    new THREE.Vector2(rOut, y + half), new THREE.Vector2(rIn, y + half),
  ];
  const g = new THREE.LatheGeometry(pts, SEG);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 实心圆锥/锥台（匹配碰撞 cone：r0@y0 → r1@y1） */
function latheCone(y0: number, y1: number, r0: number, r1: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0, y0), new THREE.Vector2(r0, y0),
    new THREE.Vector2(r1, y1), new THREE.Vector2(0, y1),
  ];
  const g = new THREE.LatheGeometry(pts, SEG);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 实心圆柱（匹配碰撞 cylinder） */
function solidCylinder(y0: number, y1: number, r: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, 40, 1, false);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** 圆环（匹配碰撞 torusRing：中心 cy，环半径 rRing，管半径 rTube） */
function torusRing(cy: number, rRing: number, rTube: number): THREE.Mesh {
  const g = new THREE.TorusGeometry(rRing, rTube, 12, SEG);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g);
  m.position.y = cy;
  return m;
}

function boxAt(c: [number, number, number], size: [number, number, number]): THREE.Mesh {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const m = new THREE.Mesh(g);
  m.position.set(c[0], c[1], c[2]);
  return m;
}

/**
 * 叶片环 InstancedMesh：叶片盒沿 X 为展向，Y 为弦向，Z 为厚度；
 * 实例变换 = Ry(φ)·Rx(stagger) + 平移到轮毂半径，天然支持每环一片矩阵。
 */
function bladeRowInstanced(spec: BladeSpec, mat: THREE.Material): THREE.InstancedMesh {
  const span = Math.max(0.001, spec.rTip - spec.rHub);
  const geo = new THREE.BoxGeometry(span, spec.chord, spec.thick);
  const inst = new THREE.InstancedMesh(geo, mat, spec.n);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ'; // Ry·Rx
  const rC = spec.rHub + span / 2;
  for (let i = 0; i < spec.n; i++) {
    const phi = (Math.PI * 2 * i) / spec.n;
    dummy.position.set(Math.cos(phi) * rC, spec.y, Math.sin(phi) * rC);
    dummy.rotation.set((spec.twist * Math.PI) / 180, phi, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** 火焰筒冷却孔：120 个小圆环 InstancedMesh，孔轴沿径向 */
function linerHolesInstanced(mat: THREE.Material): THREE.InstancedMesh {
  const h = GEOM.liner.holes;
  const n = h.primaryN + h.dilutionN;
  const geo = new THREE.TorusGeometry(h.rTube, h.rTube * 0.45, 8, 16);
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const dummy = new THREE.Object3D();
  let i = 0;
  const rows: [number, number][] = [
    [h.primaryY, h.primaryN], [h.dilutionY, h.dilutionN],
  ];
  for (const [y, count] of rows) {
    for (let k = 0; k < count; k++) {
      const phi = (Math.PI * 2 * k) / count;
      dummy.position.set(Math.cos(phi) * h.rRing, y, Math.sin(phi) * h.rRing);
      dummy.rotation.set(0, Math.PI / 2 - phi, 0); // +Z(孔轴) → 径向
      dummy.updateMatrix();
      inst.setMatrixAt(i++, dummy.matrix);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** 喷嘴 20 根供油支管 InstancedMesh（径向短柱） */
function nozzleStemsInstanced(mat: THREE.Material): THREE.InstancedMesh {
  const nz = GEOM.nozzles;
  const geo = new THREE.CylinderGeometry(0.008, 0.008, nz.stem, 8, 1, false);
  geo.rotateX(Math.PI / 2); // +Y → +Z
  geo.translate(0, 0, nz.stem / 2); // 沿 +Z 从 0 伸到 stem
  const inst = new THREE.InstancedMesh(geo, mat, nz.n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < nz.n; i++) {
    const phi = (Math.PI * 2 * i) / nz.n;
    dummy.position.set(Math.cos(phi) * nz.rRing, nz.cy, Math.sin(phi) * nz.rRing);
    dummy.rotation.set(0, Math.PI / 2 - phi, 0); // +Z → 径向
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** 解析包围盒（装配位姿，源自碰撞实体描述） */
export function partBBox(id: number): { min: THREE.Vector3; max: THREE.Vector3 } {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const s of solidsOfPart(id)) {
    let y0 = 0, y1 = 0, rMax = 0;
    switch (s.kind) {
      case 'annulus': y0 = s.y0; y1 = s.y1; rMax = s.rOut; break;
      case 'cylinder': y0 = s.y0; y1 = s.y1; rMax = s.r; break;
      case 'cone': y0 = s.y0; y1 = s.y1; rMax = Math.max(s.r0, s.r1); break;
      case 'disc': y0 = s.y - s.half; y1 = s.y + s.half; rMax = s.rOut; break;
      case 'torusRing': y0 = s.cy - s.rTube; y1 = s.cy + s.rTube; rMax = s.rRing + s.rTube; break;
      case 'bladeRow': y0 = s.y - s.chord / 2; y1 = s.y + s.chord / 2; rMax = s.rTip; break;
      case 'box':
        min.min(new THREE.Vector3(s.c[0] - s.size[0] / 2, s.c[1] - s.size[1] / 2, s.c[2] - s.size[2] / 2));
        max.max(new THREE.Vector3(s.c[0] + s.size[0] / 2, s.c[1] + s.size[1] / 2, s.c[2] + s.size[2] / 2));
        continue;
      default: continue;
    }
    min.min(new THREE.Vector3(-rMax, y0, -rMax));
    max.max(new THREE.Vector3(rMax, y1, rMax));
  }
  return { min, max };
}

/** 单零件标签挂点：包围盒顶端上方 */
export function partLabelAnchor(id: number): THREE.Vector3 {
  const b = partBBox(id);
  return new THREE.Vector3(0, b.max.y + 0.16, 0);
}

export class PartFactory {
  build(part: PartDef): PartNode {
    const g = GEOM;
    const mats = makePartMaterials(part);
    const group = new THREE.Group();
    group.name = `part-${part.id}`;
    const pickables: THREE.Object3D[] = [];
    const statics: THREE.Mesh[] = [];
    const add = (o: THREE.Mesh | THREE.InstancedMesh) => {
      o.userData.partId = part.id;
      // 实例化行不进阴影通道：阴影 pass 会重绘所有 castShadow 网格，
      // 叶片级阴影视觉收益极低，砍掉后 draw calls 才进 120 预算。
      o.castShadow = !(o instanceof THREE.InstancedMesh);
      o.receiveShadow = true;
      group.add(o);
      pickables.push(o);
      // 注意：InstancedMesh extends Mesh，必须显式排除，否则实例行会被错误合并（实例数据丢失）
      if (!(o instanceof THREE.InstancedMesh)) statics.push(o);
    };
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material = mats.solid) => {
      const m = new THREE.Mesh(geo, mat);
      add(m);
      return m;
    };

    switch (part.id) {
      case 1: // 进气道唇口
        mesh(latheRing(g.inlet.y0, g.inlet.y1, g.inlet.rIn, g.inlet.rOut));
        mesh(new THREE.TorusGeometry(g.inlet.rOut, g.inlet.lipR, 12, SEG)).rotateX(Math.PI / 2);
        (pickables[pickables.length - 1] as THREE.Mesh).position.y = g.inlet.lipY;
        break;
      case 2: // 风扇整流罩与外部机匣
        mesh(latheRing(g.casing.y0, g.casing.y1, g.casing.rIn, g.casing.rOut));
        break;
      case 3: // 风扇叶片
        add(bladeRowInstanced({ ...g.fan, y: g.fan.bladeY, n: g.fan.n, rHub: g.fan.rHub, rTip: g.fan.rTip, chord: g.fan.chord, thick: g.fan.thick, twist: g.fan.twist }, mats.solid));
        break;
      case 4: // 整流锥
        mesh(solidCylinder(g.spinner.hubY0, g.spinner.hubY1, g.spinner.hubR));
        mesh(latheCone(g.spinner.baseY, g.spinner.apexY, g.spinner.baseR, 0.02));
        break;
      case 5: // 风扇盘
        mesh(latheDisc(g.fanDisk.y, g.fanDisk.half, g.fanDisk.rIn, g.fanDisk.rOut));
        break;
      case 6: { // 风扇承力框架
        const ring = torusRing(g.fanFrame.y, g.fanFrame.rRing, g.fanFrame.rTube);
        add(ring);
        add(bladeRowInstanced({ y: g.fanFrame.y, n: g.fanFrame.n, rHub: g.fanFrame.rHub, rTip: g.fanFrame.rTip, chord: g.fanFrame.chord, thick: g.fanFrame.thick, twist: 0 }, mats.solid));
        break;
      }
      case 7: // 低压压气机
        for (const s of g.lpc.stages) {
          mesh(latheDisc(s.y, g.lpc.discHalf, g.lpc.discRIn, s.r));
          add(bladeRowInstanced({ y: s.y, n: g.lpc.blade.n, rHub: g.lpc.blade.rHub, rTip: s.r, chord: g.lpc.blade.chord, thick: g.lpc.blade.thick, twist: g.lpc.blade.twist }, mats.solid));
        }
        break;
      case 8: // 低压压气机静子
        mesh(latheRing(g.lpcStator.y0, g.lpcStator.y1, g.lpcStator.rIn, g.lpcStator.rOut));
        for (const y of g.lpcStator.rows) {
          add(bladeRowInstanced({ y, n: g.lpcStator.blade.n, rHub: g.lpcStator.blade.rHub, rTip: g.lpcStator.rIn, chord: g.lpcStator.blade.chord, thick: g.lpcStator.blade.thick, twist: g.lpcStator.blade.twist }, mats.solid));
        }
        break;
      case 9: // 高压压气机转子
        for (const s of g.hpc.stages) {
          mesh(latheDisc(s.y, g.hpc.discHalf, g.hpc.discRIn, s.r));
          add(bladeRowInstanced({ y: s.y, n: g.hpc.blade.n, rHub: g.hpc.blade.rHub, rTip: s.r, chord: g.hpc.blade.chord, thick: g.hpc.blade.thick, twist: g.hpc.blade.twist }, mats.solid));
        }
        break;
      case 10: // 高压压气机静子
        mesh(latheRing(g.hpcStator.y0, g.hpcStator.y1, g.hpcStator.rIn, g.hpcStator.rOut));
        for (const y of g.hpcStator.rows) {
          add(bladeRowInstanced({ y, n: g.hpcStator.blade.n, rHub: g.hpcStator.blade.rHub, rTip: g.hpcStator.rIn, chord: g.hpcStator.blade.chord, thick: g.hpcStator.blade.thick, twist: g.hpcStator.blade.twist }, mats.solid));
        }
        break;
      case 11: // 核心机匣（ghost）
        mesh(latheRing(g.coreCasing.y0, g.coreCasing.y1, g.coreCasing.rIn, g.coreCasing.rOut));
        break;
      case 12: // 燃烧室外机匣（ghost）
        mesh(latheRing(g.combCasing.y0, g.combCasing.y1, g.combCasing.rIn, g.combCasing.rOut));
        break;
      case 13: // 火焰筒
        mesh(latheRing(g.liner.y0, g.liner.y1, g.liner.inner.rIn, g.liner.inner.rOut));
        mesh(latheRing(g.liner.y0, g.liner.y1, g.liner.outer.rIn, g.liner.outer.rOut));
        add(torusRing(g.liner.swirler.cy, g.liner.swirler.rRing, g.liner.swirler.rTube));
        add(linerHolesInstanced(mats.solid));
        break;
      case 14: // 燃油喷嘴
        add(torusRing(g.nozzles.cy, g.nozzles.rRing, g.nozzles.rTube));
        add(nozzleStemsInstanced(mats.solid));
        break;
      case 15: // 高压涡轮导向器
        mesh(latheRing(g.hptNozzle.y0, g.hptNozzle.y1, g.hptNozzle.rIn, g.hptNozzle.rOut));
        add(bladeRowInstanced({ y: g.hptNozzle.bladeY, n: g.hptNozzle.blade.n, rHub: g.hptNozzle.blade.rHub, rTip: g.hptNozzle.rIn, chord: g.hptNozzle.blade.chord, thick: g.hptNozzle.blade.thick, twist: g.hptNozzle.blade.twist }, mats.solid));
        break;
      case 16: // 高压涡轮转子
        mesh(latheDisc(g.hptRotor.y, g.hptRotor.half, g.hptRotor.rIn, g.hptRotor.rOut));
        add(bladeRowInstanced({ y: g.hptRotor.y, n: g.hptRotor.blade.n, rHub: g.hptRotor.blade.rHub, rTip: g.hptRotor.rOut + 0.02, chord: g.hptRotor.blade.chord, thick: g.hptRotor.blade.thick, twist: g.hptRotor.blade.twist }, mats.solid));
        break;
      case 17: // 低压涡轮导向器
        mesh(latheRing(g.lptNozzle.y0, g.lptNozzle.y1, g.lptNozzle.rIn, g.lptNozzle.rOut));
        add(bladeRowInstanced({ y: g.lptNozzle.bladeY, n: g.lptNozzle.blade.n, rHub: g.lptNozzle.blade.rHub, rTip: g.lptNozzle.rIn, chord: g.lptNozzle.blade.chord, thick: g.lptNozzle.blade.thick, twist: g.lptNozzle.blade.twist }, mats.solid));
        break;
      case 18: // 低压涡轮转子
        for (const s of g.lptRotor.stages) {
          mesh(latheDisc(s.y, g.lptRotor.discHalf, g.lptRotor.discRIn, s.r));
          add(bladeRowInstanced({ y: s.y, n: g.lptRotor.blade.n, rHub: g.lptRotor.blade.rHub, rTip: s.r, chord: g.lptRotor.blade.chord, thick: g.lptRotor.blade.thick, twist: g.lptRotor.blade.twist }, mats.solid));
        }
        break;
      case 19: // 低压轴
        mesh(solidCylinder(g.lpShaft.y0, g.lpShaft.y1, g.lpShaft.r));
        break;
      case 20: // 高压轴
        mesh(latheRing(g.hpShaft.y0, g.hpShaft.y1, g.hpShaft.rIn, g.hpShaft.rOut));
        break;
      case 21: // 轴承与支撑结构
        mesh(solidCylinder(g.bearings.house.y0, g.bearings.house.y1, g.bearings.house.r));
        mesh(latheDisc(g.bearings.ring.y, g.bearings.ring.half, g.bearings.ring.rIn, g.bearings.ring.rOut));
        add(bladeRowInstanced({ y: g.bearings.struts.y, n: g.bearings.struts.n, rHub: g.bearings.struts.rHub, rTip: g.bearings.struts.rTip, chord: g.bearings.struts.chord, thick: g.bearings.struts.thick, twist: 0 }, mats.solid));
        break;
      case 22: // 尾喷管
        mesh(latheRing(g.exhaustNozzle.wall.y0, g.exhaustNozzle.wall.y1, g.exhaustNozzle.wall.rIn, g.exhaustNozzle.wall.rOut));
        mesh(latheCone(g.exhaustNozzle.tailCone.y0, g.exhaustNozzle.tailCone.y1, g.exhaustNozzle.tailCone.r0, g.exhaustNozzle.tailCone.r1));
        break;
      case 23: // 附件传动齿轮箱
        add(boxAt(g.gearbox.c, g.gearbox.size));
        break;
      case 24: // 外涵道（ghost）
        mesh(latheRing(g.bypassDuct.y0, g.bypassDuct.y1, g.bypassDuct.rIn, g.bypassDuct.rOut));
        break;
      default:
        throw new Error('unknown part ' + part.id);
    }

    // ---- 静态网格合并为 1 个网格：每零件静态 draw call ≤1（预算 ≤120 的关键） ----
    // 把局部矩阵 bake 进几何再合并；原静态网格移除并 dispose，材质统一 mats.solid。
    if (statics.length > 0) {
      const merged = new THREE.Mesh(
        mergeGeometries(statics.map((m) => {
          m.updateMatrix();
          m.geometry.applyMatrix4(m.matrix);
          return m.geometry;
        }), false),
        mats.solid,
      );
      merged.userData.partId = part.id;
      merged.castShadow = true;
      merged.receiveShadow = true;
      group.add(merged);
      pickables.push(merged);
      for (const m of statics) {
        group.remove(m);
        const i = pickables.indexOf(m);
        if (i >= 0) pickables.splice(i, 1);
        m.geometry.dispose();
      }
    }

    return {
      id: part.id,
      group,
      mats,
      pickables,
      labelAnchor: partLabelAnchor(part.id),
      bbox: partBBox(part.id),
    };
  }

  buildAll(): Map<number, PartNode> {
    const map = new Map<number, PartNode>();
    for (const p of PARTS) map.set(p.id, this.build(p));
    return map;
  }
}

/** 切换 ghost 零件半透明材质（剖切开关驱动） */
export function applyGhostMode(node: PartNode, on: boolean): void {
  if (!node.mats.ghost) return;
  if (node.mats.ghostActive === on) return;
  node.mats.ghostActive = on;
  const mat = on ? node.mats.ghost : node.mats.solid;
  for (const o of node.pickables) {
    (o as THREE.Mesh).material = mat;
  }
}

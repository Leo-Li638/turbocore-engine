// ============================================================================
// 材质层：每个零件一套标准材质 + 可选 ghost 半透明材质（剖切时机匣半透）
// ============================================================================
import * as THREE from 'three';
import type { PartDef, ZoneId } from '../data/parts';
import { ZONE_COLORS } from '../data/parts';

export const ACCENT = new THREE.Color('#39E6FF');

export interface PartMaterials {
  solid: THREE.MeshStandardMaterial;
  /** ghost 零件（02/11/12/24）剖切时切换的半透明材质 */
  ghost: THREE.MeshStandardMaterial | null;
  /** 当前是否处于 ghost 态（由剖切开关驱动） */
  ghostActive: boolean;
}

/** 区域色 → 材质基色（略压暗以获得金属质感） */
export function zoneBaseColor(zone: ZoneId): THREE.Color {
  return new THREE.Color(ZONE_COLORS[zone]).multiplyScalar(0.88);
}

function baseMat(color: THREE.Color, opts: { metalness?: number; roughness?: number; emissive?: THREE.Color } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color.clone(),
    metalness: opts.metalness ?? 0.85,
    roughness: opts.roughness ?? 0.38,
    emissive: opts.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveIntensity: opts.emissive ? 0.55 : 0,
  });
}

/** 燃烧区零件（火焰筒/喷嘴环）内壁带核心焰色自发光 */
export function makePartMaterials(part: PartDef): PartMaterials {
  const base = zoneBaseColor(part.zone);
  const isCombustor = part.zone === 'combustor';
  const solid = baseMat(base, isCombustor ? { emissive: new THREE.Color('#FF5A1F') } : {});
  // 火焰筒/喷嘴：暖色自发光更明显
  if (part.id === 13 || part.id === 14) {
    solid.emissive = new THREE.Color('#FF5A1F').clone();
    solid.emissiveIntensity = 0.5;
    solid.roughness = 0.55;
  }
  let ghost: THREE.MeshStandardMaterial | null = null;
  if (part.ghost) {
    ghost = baseMat(base, { metalness: 0.5, roughness: 0.5 });
    ghost.transparent = true;
    ghost.opacity = 0.12;
    ghost.side = THREE.DoubleSide;
    ghost.depthWrite = false;
  }
  return { solid, ghost, ghostActive: false };
}

/** 高亮（选中态）：青蓝辉光 + 提亮 */
export function setHighlight(mats: PartMaterials, on: boolean): void {
  const apply = (m: THREE.MeshStandardMaterial | null) => {
    if (!m) return;
    if (on) {
      m.emissive = ACCENT.clone();
      m.emissiveIntensity = 0.5;
    } else {
      // 燃烧区恢复核心焰色，其余恢复无自发光
      m.emissive = m.userData.baseEmissive ? (m.userData.baseEmissive as THREE.Color).clone() : new THREE.Color(0x000000);
      m.emissiveIntensity = (m.userData.baseEmissiveIntensity as number) ?? 0;
    }
  };
  // 首次调用时记录基准自发光
  if (mats.solid.userData.baseEmissive === undefined) {
    mats.solid.userData.baseEmissive = mats.solid.emissive.clone();
    mats.solid.userData.baseEmissiveIntensity = mats.solid.emissiveIntensity;
    if (mats.ghost) {
      mats.ghost.userData.baseEmissive = mats.ghost.emissive.clone();
      mats.ghost.userData.baseEmissiveIntensity = mats.ghost.emissiveIntensity;
    }
  }
  apply(mats.solid);
  apply(mats.ghost);
}

/** 悬停轻微提亮 */
export function setHover(mats: PartMaterials, on: boolean): void {
  if (mats.solid.userData.highlighted) return; // 选中态不覆盖悬停
  mats.solid.emissiveIntensity = on ? 0.22 : ((mats.solid.userData.baseEmissiveIntensity as number) ?? 0);
  if (!on) {
    mats.solid.emissive = mats.solid.userData.baseEmissive
      ? (mats.solid.userData.baseEmissive as THREE.Color).clone()
      : new THREE.Color(0x000000);
  } else if (mats.solid.emissive.getHex() === 0x000000) {
    mats.solid.emissive = ACCENT.clone();
  }
}

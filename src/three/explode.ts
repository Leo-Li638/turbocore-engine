// ============================================================================
// 爆炸分解纯函数：分组级联窗口、easeInOutCubic、位姿插值
// 全部确定性、无副作用，vitest 覆盖。
// ============================================================================
import { PARTS, GROUPS, PartDef, partsOfGroup } from '../data/parts';

export const clamp01 = (p: number): number => (p < 0 ? 0 : p > 1 ? 1 : p);

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 零件在 0–1 轨道上的级联时间窗（组窗 + 组内按 id 顺序微错峰） */
export function partWindow(part: PartDef): [number, number] {
  const g = GROUPS.find((x) => x.id === part.groupId)!;
  const idx = partsOfGroup(g.id).findIndex((p) => p.id === part.id);
  const stagger = idx * 0.01;
  const start = Math.min(g.window[0] + stagger, g.window[1] - 0.004);
  return [start, g.window[1]];
}

/** 给定全局进度，返回该零件的展开系数 t ∈ [0,1]（已套缓动） */
export function partEase(partId: number, progress: number): number {
  const part = PARTS.find((p) => p.id === partId)!;
  const [a, b] = partWindow(part);
  const p = clamp01(progress);
  if (p <= a) return 0;
  if (p >= b) return 1;
  return easeInOutCubic((p - a) / (b - a));
}

export type Vec3 = [number, number, number];

export interface PoseInput {
  id: number;
  /** 装配位姿（零件建模时在场景中的基础位置） */
  assembled: Vec3;
  /** 爆炸目标 = assembled + explodeOffset（来自 parts.ts） */
  exploded: Vec3;
}

export function computePosition(assembled: Vec3, exploded: Vec3, t: number): Vec3 {
  const k = clamp01(t);
  return [
    assembled[0] + (exploded[0] - assembled[0]) * k,
    assembled[1] + (exploded[1] - assembled[1]) * k,
    assembled[2] + (exploded[2] - assembled[2]) * k,
  ];
}

/** 一次计算全部零件在给定 progress 下的位姿（确定性纯函数） */
export function computeAllPositions(
  poses: PoseInput[],
  progress: number,
): Map<number, Vec3> {
  const out = new Map<number, Vec3>();
  for (const pose of poses) {
    const t = partEase(pose.id, progress);
    out.set(pose.id, computePosition(pose.assembled, pose.exploded, t));
  }
  return out;
}

/** 为零件构造 PoseInput（assembled 取建模基础位置，exploded 加偏移） */
export function makePose(id: number, assembled: Vec3, offset: Vec3): PoseInput {
  return {
    id,
    assembled,
    exploded: [assembled[0] + offset[0], assembled[1] + offset[1], assembled[2] + offset[2]],
  };
}

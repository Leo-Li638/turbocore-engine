import { describe, it, expect } from 'vitest';
import {
  clamp01, easeInOutCubic, partWindow, partEase,
  computePosition, computeAllPositions, makePose, PoseInput,
} from '../src/three/explode';
import { PARTS, partById, groupById, partsOfGroup } from '../src/data/parts';

describe('clamp01 / easeInOutCubic', () => {
  it('clamp01 钳制边界', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.37)).toBe(0.37);
  });
  it('easeInOutCubic 端点与中点', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 12);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 12);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 12);
    expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 12);
  });
  it('easeInOutCubic 单调不减', () => {
    let prev = 0;
    for (let i = 0; i <= 200; i++) {
      const v = easeInOutCubic(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('分组级联时间窗', () => {
  it('六个分组窗口与需求一致', () => {
    const wins: Record<string, [number, number]> = {
      A: [0.0, 0.22], B: [0.18, 0.42], C: [0.38, 0.58],
      D: [0.54, 0.78], E: [0.74, 0.88], F: [0.84, 1.0],
    };
    for (const g of Object.values(groupById)) {
      void g;
    }
    for (const [id, w] of Object.entries(wins)) {
      const g = groupById(id as 'A');
      expect(g.window[0]).toBeCloseTo(w[0]);
      expect(g.window[1]).toBeCloseTo(w[1]);
    }
  });
  it('组内按 id 顺序微错峰（首件=组起点，其余依次后移）', () => {
    for (const gid of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
      const parts = partsOfGroup(gid);
      const [w0] = partWindow(parts[0]);
      expect(w0).toBeCloseTo(groupById(gid).window[0]);
      for (let i = 1; i < parts.length; i++) {
        const [wi] = partWindow(parts[i]);
        const [wPrev] = partWindow(parts[i - 1]);
        expect(wi).toBeGreaterThan(wPrev);
        expect(wi).toBeLessThan(groupById(gid).window[1]);
      }
      // 组末件在组窗结束时全部展开到位
      const last = partWindow(parts[parts.length - 1]);
      expect(last[1]).toBeCloseTo(groupById(gid).window[1]);
    }
  });
});

describe('partEase 级联缓动', () => {
  it('p=0 全部为 0，p=1 全部为 1', () => {
    for (const p of PARTS) {
      expect(partEase(p.id, 0)).toBe(0);
      expect(partEase(p.id, 1)).toBe(1);
    }
  });
  it('单调不减且无硬切（中间值连续过渡）', () => {
    for (const p of PARTS) {
      let prev = 0;
      for (let i = 0; i <= 100; i++) {
        const v = partEase(p.id, i / 100);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
    }
  });
  it('展开顺序严格 A→B→C→D→E→F（同一 progress 下前组完成度 >= 后组）', () => {
    const order: string[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const prog of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      const eases = new Map<string, number>();
      for (const gid of order) {
        const parts = partsOfGroup(gid as 'A');
        eases.set(gid, Math.max(...parts.map((p) => partEase(p.id, prog))));
      }
      for (let i = 1; i < order.length; i++) {
        expect(eases.get(order[i])!).toBeLessThanOrEqual(eases.get(order[i - 1])! + 1e-12);
      }
    }
  });
});

describe('位姿插值', () => {
  const poses: PoseInput[] = PARTS.map((p) =>
    makePose(p.id, [1, 2, 3], p.explodeOffset),
  );

  it('computePosition 线性插值', () => {
    const pos = computePosition([0, 0, 0], [10, 20, 30], 0.25);
    expect(pos[0]).toBeCloseTo(2.5);
    expect(pos[1]).toBeCloseTo(5);
    expect(pos[2]).toBeCloseTo(7.5);
  });

  it('p=0 全部归装配位，p=1 全部到爆炸目标', () => {
    const at0 = computeAllPositions(poses, 0);
    const at1 = computeAllPositions(poses, 1);
    for (const p of PARTS) {
      const a = at0.get(p.id)!;
      const e = at1.get(p.id)!;
      expect(a[0]).toBeCloseTo(1); expect(a[1]).toBeCloseTo(2); expect(a[2]).toBeCloseTo(3);
      expect(e[0]).toBeCloseTo(1 + p.explodeOffset[0]);
      expect(e[1]).toBeCloseTo(2 + p.explodeOffset[1]);
      expect(e[2]).toBeCloseTo(3 + p.explodeOffset[2]);
    }
  });

  it('25%/50%/75% 位姿快照稳定（同输入同输出、反复计算一致）', () => {
    for (const prog of [0.25, 0.5, 0.75]) {
      const snap1 = computeAllPositions(poses, prog);
      const snap2 = computeAllPositions(poses, prog);
      expect(snap1.size).toBe(PARTS.length);
      for (const p of PARTS) {
        expect(snap2.get(p.id)).toEqual(snap1.get(p.id));
      }
    }
  });

  it('已知点位校验（01 进气道在 0.11 = 组窗中点 → t=0.5 → 半程）', () => {
    // A 组窗 [0, 0.22]，01 无错峰 → local=(0.11-0)/(0.22-0)=0.5 → ease(0.5)=0.5
    const p1 = partById(1);
    const t = partEase(1, 0.11);
    expect(t).toBeCloseTo(0.5, 12);
    const pos = computePosition([1, 2, 3], [1 + p1.explodeOffset[0], 2 + p1.explodeOffset[1], 3 + p1.explodeOffset[2]], t);
    expect(pos[1]).toBeCloseTo(2 + p1.explodeOffset[1] * 0.5, 12);
  });

  it('explodeEuler 全为 0（保持碰撞数学精确），由数据文件保证', () => {
    for (const p of PARTS) {
      if (p.explodeEuler) {
        expect(p.explodeEuler).toEqual([0, 0, 0]);
      }
    }
  });
});

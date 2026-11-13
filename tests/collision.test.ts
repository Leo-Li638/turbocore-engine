import { describe, it, expect } from 'vitest';
import { PARTS } from '../src/data/parts';
import { solidsOfPart, containsPoint, SolidPrim } from '../src/three/solids';

/** 对实体表面采样（0.05 m 网格级别），返回世界坐标表面点 */
function sampleSurface(s: SolidPrim): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const step = 0.05;
  const add = (x: number, y: number, z: number) => pts.push([x, y, z]);
  switch (s.kind) {
    case 'annulus': {
      for (let y = s.y0; y <= s.y1 + 1e-9; y += step) {
        for (let phi = 0; phi < Math.PI * 2; phi += 0.3) {
          add(Math.cos(phi) * s.rIn, y, Math.sin(phi) * s.rIn);
          add(Math.cos(phi) * s.rOut, y, Math.sin(phi) * s.rOut);
        }
      }
      // 上下环面
      for (const y of [s.y0, s.y1]) {
        for (let r = s.rIn; r <= s.rOut + 1e-9; r += step) {
          for (let phi = 0; phi < Math.PI * 2; phi += 0.4) add(Math.cos(phi) * r, y, Math.sin(phi) * r);
        }
      }
      break;
    }
    case 'cylinder': {
      for (let y = s.y0; y <= s.y1 + 1e-9; y += step) {
        for (let phi = 0; phi < Math.PI * 2; phi += 0.3) add(Math.cos(phi) * s.r, y, Math.sin(phi) * s.r);
      }
      for (let r = 0; r <= s.r + 1e-9; r += step) {
        for (let phi = 0; phi < Math.PI * 2; phi += 0.5) {
          add(Math.cos(phi) * r, s.y0, Math.sin(phi) * r);
          add(Math.cos(phi) * r, s.y1, Math.sin(phi) * r);
        }
      }
      break;
    }
    case 'cone': {
      for (let y = s.y0; y <= s.y1 + 1e-9; y += step) {
        const t = (y - s.y0) / (s.y1 - s.y0);
        const r = s.r0 + (s.r1 - s.r0) * t;
        for (let phi = 0; phi < Math.PI * 2; phi += 0.3) add(Math.cos(phi) * r, y, Math.sin(phi) * r);
      }
      for (const y of [s.y0, s.y1]) {
        const r = y === s.y0 ? s.r0 : s.r1;
        for (let rr = 0; rr <= r + 1e-9; rr += step) {
          for (let phi = 0; phi < Math.PI * 2; phi += 0.5) add(Math.cos(phi) * rr, y, Math.sin(phi) * rr);
        }
      }
      break;
    }
    case 'disc': {
      for (let phi = 0; phi < Math.PI * 2; phi += 0.25) {
        add(Math.cos(phi) * s.rIn, s.y, Math.sin(phi) * s.rIn);
        add(Math.cos(phi) * s.rOut, s.y, Math.sin(phi) * s.rOut);
      }
      for (let r = s.rIn; r <= s.rOut + 1e-9; r += step) {
        for (let phi = 0; phi < Math.PI * 2; phi += 0.4) {
          add(Math.cos(phi) * r, s.y - s.half, Math.sin(phi) * r);
          add(Math.cos(phi) * r, s.y + s.half, Math.sin(phi) * r);
        }
      }
      break;
    }
    case 'torusRing': {
      for (let phi = 0; phi < Math.PI * 2; phi += 0.2) {
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
          add(
            (s.rRing + s.rTube * Math.cos(a)) * Math.cos(phi),
            s.cy + s.rTube * Math.sin(a),
            (s.rRing + s.rTube * Math.cos(a)) * Math.sin(phi),
          );
        }
      }
      break;
    }
    case 'bladeRow': {
      // 每片叶：上下端面 + 前缘/后缘 + 内/外端
      for (let i = 0; i < s.n; i++) {
        const th = (Math.PI * 2 * i) / s.n;
        const cy = s.rHub + (s.rTip - s.rHub) / 2;
        const halfSpan = (s.rTip - s.rHub) / 2;
        for (let a = -1; a <= 1; a += 0.5) {
          const rr = cy + halfSpan * a;
          for (let c = -1; c <= 1; c += 2) {
            for (let t = -1; t <= 1; t += 2) {
              const x = Math.cos(th) * rr - Math.sin(th) * t * (s.thick / 2);
              const z = Math.sin(th) * rr + Math.cos(th) * t * (s.thick / 2);
              add(x, s.y + (c * s.chord) / 2, z);
            }
          }
        }
      }
      break;
    }
    case 'box': {
      const [sx, sy, sz] = s.size;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
        add(s.c[0] + (dx * sx) / 2, s.c[1] + (dy * sy) / 2, s.c[2] + (dz * sz) / 2);
      }
      for (let x = s.c[0] - sx / 2; x <= s.c[0] + sx / 2 + 1e-9; x += step) {
        add(x, s.c[1], s.c[2]);
      }
      break;
    }
  }
  return pts;
}

describe('完全分解态（p=1）碰撞检测', () => {
  it('24 个零件在爆炸目标位姿下两两无穿插', () => {
    // 对每个零件：采样其全部实体表面点 → 平移到爆炸目标 → 检查是否落入任何其他零件实体内部
    const violations: string[] = [];
    const totalSamples: number[] = [];
    for (const part of PARTS) {
      const solids = solidsOfPart(part.id);
      const [ox, oy, oz] = part.explodeOffset;
      let sampled = 0;
      for (const s of solids) {
        const pts = sampleSurface(s);
        for (const [x, y, z] of pts) {
          sampled++;
          const wx = x + ox, wy = y + oy, wz = z + oz;
          for (const other of PARTS) {
            if (other.id === part.id) continue;
            // 把世界坐标点变换到对方零件爆炸位姿的局部系（对方实体定义在装配局部系）
            const [oox, ooy, ooz] = other.explodeOffset;
            const lx = wx - oox, ly = wy - ooy, lz = wz - ooz;
            for (const os of solidsOfPart(other.id)) {
              if (containsPoint(os, lx, ly, lz)) {
                violations.push(`${part.id}(${part.zh}) 表面点 (${wx.toFixed(2)},${wy.toFixed(2)},${wz.toFixed(2)}) 穿入 ${other.id}(${other.zh})`);
              }
            }
          }
        }
      }
      totalSamples.push(sampled);
    }
    // 输出采样规模便于审计
    console.log('collision samples per part:', totalSamples.join(','));
    expect(violations).toEqual([]);
  }, 120000);

  it('爆炸目标整体仍在取景范围内（包围盒 |x|,|z| ≤ 3.6 m，y ∈ [-3.1, 4.6]）', () => {
    for (const part of PARTS) {
      const [ox, oy, oz] = part.explodeOffset;
      for (const s of solidsOfPart(part.id)) {
        for (const [x, y, z] of sampleSurface(s)) {
          const wx = x + ox, wy = y + oy, wz = z + oz;
          expect(Math.hypot(wx, wz)).toBeLessThanOrEqual(3.6);
          expect(wy).toBeGreaterThanOrEqual(-3.1);
          expect(wy).toBeLessThanOrEqual(4.6);
        }
      }
    }
  }, 120000);

  it('装配态（p=0）实体与网格同源：24 个零件均有实体定义', () => {
    for (const part of PARTS) {
      expect(solidsOfPart(part.id).length).toBeGreaterThan(0);
    }
  });
});

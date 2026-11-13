// ============================================================================
// 碰撞检测实体描述（单一几何常量源：PartFactory 按它建网格，碰撞测试按它采样）
// 坐标系：发动机沿 +Y（前端=+Y）。
// ============================================================================

export type SolidPrim =
  | { kind: 'annulus'; y0: number; y1: number; rIn: number; rOut: number }
  | { kind: 'cylinder'; y0: number; y1: number; r: number }
  | { kind: 'cone'; y0: number; y1: number; r0: number; r1: number }
  | { kind: 'disc'; y: number; half: number; rIn: number; rOut: number }
  | { kind: 'torusRing'; cy: number; rRing: number; rTube: number }
  | { kind: 'bladeRow'; y: number; n: number; rHub: number; rTip: number; chord: number; thick: number }
  | { kind: 'box'; c: [number, number, number]; size: [number, number, number] };

export interface BladeSpec {
  y: number; n: number; rHub: number; rTip: number; chord: number; thick: number; twist: number;
}

export interface DiscSpec { y: number; rIn: number; rOut: number; half: number; }

// ---------------------------------------------------------------------------
// 装配位姿常量（所有零件建模基础位置的中心/范围）
// ---------------------------------------------------------------------------
export const GEOM = {
  fan: { bladeY: 1.84, rHub: 0.32, rTip: 0.99, chord: 0.16, thick: 0.045, n: 22, twist: 55 },
  inlet: { y0: 1.97, y1: 2.12, rIn: 0.98, rOut: 1.02, lipY: 2.12, lipR: 0.045 },
  casing: { y0: 1.62, y1: 2.06, rIn: 0.97, rOut: 1.02 },
  spinner: { hubY0: 1.55, hubY1: 1.78, hubR: 0.3, apexY: 2.42, baseY: 1.74, baseR: 0.35 },
  fanDisk: { y: 1.74, rIn: 0.15, rOut: 0.42, half: 0.05 },
  fanFrame: { y: 1.55, rRing: 0.95, rTube: 0.05, rHub: 0.3, rTip: 0.95, n: 12, chord: 0.1, thick: 0.04 },
  lpc: {
    stages: [
      { y: 1.12, r: 0.52 }, { y: 1.27, r: 0.48 }, { y: 1.42, r: 0.44 },
    ],
    discRIn: 0.12, discHalf: 0.04,
    blade: { rHub: 0.2, chord: 0.09, thick: 0.03, n: 32, twist: 35 },
  },
  lpcStator: {
    y0: 0.98, y1: 1.45, rIn: 0.55, rOut: 0.6,
    rows: [1.02, 1.14, 1.26, 1.38],
    blade: { rHub: 0.42, chord: 0.06, thick: 0.02, n: 40, twist: -30 },
  },
  hpc: {
    stages: [
      { y: 0.32, r: 0.42 }, { y: 0.4, r: 0.4 }, { y: 0.48, r: 0.385 }, { y: 0.56, r: 0.37 },
      { y: 0.64, r: 0.355 }, { y: 0.72, r: 0.34 }, { y: 0.8, r: 0.325 }, { y: 0.88, r: 0.31 },
    ],
    discRIn: 0.12, discHalf: 0.03,
    blade: { rHub: 0.14, chord: 0.05, thick: 0.02, n: 36, twist: 40 },
  },
  hpcStator: {
    y0: 0.22, y1: 0.98, rIn: 0.44, rOut: 0.5,
    rows: [0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82],
    blade: { rHub: 0.3, chord: 0.05, thick: 0.018, n: 44, twist: -35 },
  },
  coreCasing: { y0: 0.15, y1: 1.5, rIn: 0.5, rOut: 0.62 },
  combCasing: { y0: -0.12, y1: 0.32, rIn: 0.52, rOut: 0.58 },
  liner: {
    y0: -0.05, y1: 0.26,
    inner: { rIn: 0.3, rOut: 0.34 }, outer: { rIn: 0.44, rOut: 0.48 },
    swirler: { cy: 0.26, rRing: 0.38, rTube: 0.05 },
    holes: { rTube: 0.008, rRing: 0.46, primaryY: 0.18, primaryN: 40, dilutionY: 0.06, dilutionN: 80 },
  },
  nozzles: { cy: 0.34, rRing: 0.4, rTube: 0.02, n: 20, stem: 0.07 },
  hptNozzle: {
    y0: -0.36, y1: -0.24, rIn: 0.4, rOut: 0.46, bladeY: -0.3,
    blade: { rHub: 0.3, chord: 0.05, thick: 0.02, n: 32, twist: 45 },
  },
  hptRotor: {
    y: -0.48, rIn: 0.12, rOut: 0.4, half: 0.05,
    blade: { rHub: 0.16, chord: 0.07, thick: 0.025, n: 68, twist: 40 },
  },
  lptNozzle: {
    y0: -0.94, y1: -0.82, rIn: 0.52, rOut: 0.58, bladeY: -0.88,
    blade: { rHub: 0.34, chord: 0.05, thick: 0.02, n: 46, twist: 45 },
  },
  lptRotor: {
    stages: [
      { y: -1.1, r: 0.58 }, { y: -1.32, r: 0.62 }, { y: -1.54, r: 0.65 },
    ],
    discRIn: 0.12, discHalf: 0.045,
    blade: { rHub: 0.18, chord: 0.06, thick: 0.025, n: 58, twist: 40 },
  },
  lpShaft: { y0: -1.9, y1: 1.88, r: 0.06 },
  hpShaft: { y0: -0.55, y1: 1.05, rIn: 0.065, rOut: 0.115 },
  bearings: {
    house: { y0: -1.82, y1: -1.62, r: 0.22 },
    ring: { y: -1.72, rIn: 0.5, rOut: 0.54, half: 0.05 },
    struts: { y: -1.72, n: 8, rHub: 0.22, rTip: 0.52, chord: 0.06, thick: 0.05 },
  },
  exhaustNozzle: {
    wall: { y0: -2.08, y1: -1.92, rIn: 0.28, rOut: 0.44 },
    tailCone: { y0: -1.95, y1: -1.7, r0: 0.18, r1: 0.03 },
  },
  gearbox: { c: [0.62, 0.95, 0.3] as [number, number, number], size: [0.38, 0.3, 0.26] as [number, number, number] },
  bypassDuct: { y0: -1.35, y1: 1.62, rIn: 0.78, rOut: 0.95 },
};

// ---------------------------------------------------------------------------
// 每个零件的碰撞实体集合（与 PartFactory 网格一一对应）
// ---------------------------------------------------------------------------
function bladeRows(list: BladeSpec[]): SolidPrim[] {
  return list.map((b) => ({ kind: 'bladeRow' as const, ...b }));
}
function discs(list: DiscSpec[]): SolidPrim[] {
  return list.map((d) => ({ kind: 'disc' as const, ...d }));
}

export function solidsOfPart(id: number): SolidPrim[] {
  const g = GEOM;
  switch (id) {
    case 1: return [
      { kind: 'annulus', y0: g.inlet.y0, y1: g.inlet.y1, rIn: g.inlet.rIn, rOut: g.inlet.rOut },
      { kind: 'torusRing', cy: g.inlet.lipY, rRing: g.inlet.rOut, rTube: g.inlet.lipR },
    ];
    case 2: return [
      { kind: 'annulus', y0: g.casing.y0, y1: g.casing.y1, rIn: g.casing.rIn, rOut: g.casing.rOut },
    ];
    case 3: return bladeRows([{
      y: g.fan.bladeY, n: g.fan.n, rHub: g.fan.rHub, rTip: g.fan.rTip,
      chord: g.fan.chord, thick: g.fan.thick, twist: g.fan.twist,
    }]);
    case 4: return [
      { kind: 'cylinder', y0: g.spinner.hubY0, y1: g.spinner.hubY1, r: g.spinner.hubR },
      { kind: 'cone', y0: g.spinner.baseY, y1: g.spinner.apexY, r0: g.spinner.baseR, r1: 0.02 },
    ];
    case 5: return discs([{ y: g.fanDisk.y, rIn: g.fanDisk.rIn, rOut: g.fanDisk.rOut, half: g.fanDisk.half }]);
    case 6: return [
      { kind: 'torusRing', cy: g.fanFrame.y, rRing: g.fanFrame.rRing, rTube: g.fanFrame.rTube },
      ...bladeRows([{
        y: g.fanFrame.y, n: g.fanFrame.n, rHub: g.fanFrame.rHub, rTip: g.fanFrame.rTip,
        chord: g.fanFrame.chord, thick: g.fanFrame.thick, twist: 0,
      }]),
    ];
    case 7: return [
      ...discs(g.lpc.stages.map((s) => ({ y: s.y, rIn: g.lpc.discRIn, rOut: s.r, half: g.lpc.discHalf }))),
      ...bladeRows(g.lpc.stages.map((s) => ({ y: s.y, n: g.lpc.blade.n, rHub: g.lpc.blade.rHub, rTip: s.r, chord: g.lpc.blade.chord, thick: g.lpc.blade.thick, twist: g.lpc.blade.twist }))),
    ];
    case 8: return [
      { kind: 'annulus', y0: g.lpcStator.y0, y1: g.lpcStator.y1, rIn: g.lpcStator.rIn, rOut: g.lpcStator.rOut },
      ...bladeRows(g.lpcStator.rows.map((y) => ({ y, n: g.lpcStator.blade.n, rHub: g.lpcStator.blade.rHub, rTip: g.lpcStator.rIn, chord: g.lpcStator.blade.chord, thick: g.lpcStator.blade.thick, twist: g.lpcStator.blade.twist }))),
    ];
    case 9: return [
      ...discs(g.hpc.stages.map((s) => ({ y: s.y, rIn: g.hpc.discRIn, rOut: s.r, half: g.hpc.discHalf }))),
      ...bladeRows(g.hpc.stages.map((s) => ({ y: s.y, n: g.hpc.blade.n, rHub: g.hpc.blade.rHub, rTip: s.r, chord: g.hpc.blade.chord, thick: g.hpc.blade.thick, twist: g.hpc.blade.twist }))),
    ];
    case 10: return [
      { kind: 'annulus', y0: g.hpcStator.y0, y1: g.hpcStator.y1, rIn: g.hpcStator.rIn, rOut: g.hpcStator.rOut },
      ...bladeRows(g.hpcStator.rows.map((y) => ({ y, n: g.hpcStator.blade.n, rHub: g.hpcStator.blade.rHub, rTip: g.hpcStator.rIn, chord: g.hpcStator.blade.chord, thick: g.hpcStator.blade.thick, twist: g.hpcStator.blade.twist }))),
    ];
    case 11: return [
      { kind: 'annulus', y0: g.coreCasing.y0, y1: g.coreCasing.y1, rIn: g.coreCasing.rIn, rOut: g.coreCasing.rOut },
    ];
    case 12: return [
      { kind: 'annulus', y0: g.combCasing.y0, y1: g.combCasing.y1, rIn: g.combCasing.rIn, rOut: g.combCasing.rOut },
    ];
    case 13: return [
      { kind: 'annulus', y0: g.liner.y0, y1: g.liner.y1, rIn: g.liner.inner.rIn, rOut: g.liner.inner.rOut },
      { kind: 'annulus', y0: g.liner.y0, y1: g.liner.y1, rIn: g.liner.outer.rIn, rOut: g.liner.outer.rOut },
      { kind: 'torusRing', cy: g.liner.swirler.cy, rRing: g.liner.swirler.rRing, rTube: g.liner.swirler.rTube },
    ];
    case 14: return [
      { kind: 'torusRing', cy: g.nozzles.cy, rRing: g.nozzles.rRing, rTube: g.nozzles.rTube },
    ];
    case 15: return [
      { kind: 'annulus', y0: g.hptNozzle.y0, y1: g.hptNozzle.y1, rIn: g.hptNozzle.rIn, rOut: g.hptNozzle.rOut },
      ...bladeRows([{
        y: g.hptNozzle.bladeY, n: g.hptNozzle.blade.n, rHub: g.hptNozzle.blade.rHub, rTip: g.hptNozzle.rIn,
        chord: g.hptNozzle.blade.chord, thick: g.hptNozzle.blade.thick, twist: g.hptNozzle.blade.twist,
      }]),
    ];
    case 16: return [
      { kind: 'disc', y: g.hptRotor.y, rIn: g.hptRotor.rIn, rOut: g.hptRotor.rOut, half: g.hptRotor.half },
      ...bladeRows([{
        y: g.hptRotor.y, n: g.hptRotor.blade.n, rHub: g.hptRotor.blade.rHub, rTip: g.hptRotor.rOut + 0.02,
        chord: g.hptRotor.blade.chord, thick: g.hptRotor.blade.thick, twist: g.hptRotor.blade.twist,
      }]),
    ];
    case 17: return [
      { kind: 'annulus', y0: g.lptNozzle.y0, y1: g.lptNozzle.y1, rIn: g.lptNozzle.rIn, rOut: g.lptNozzle.rOut },
      ...bladeRows([{
        y: g.lptNozzle.bladeY, n: g.lptNozzle.blade.n, rHub: g.lptNozzle.blade.rHub, rTip: g.lptNozzle.rIn,
        chord: g.lptNozzle.blade.chord, thick: g.lptNozzle.blade.thick, twist: g.lptNozzle.blade.twist,
      }]),
    ];
    case 18: return [
      ...discs(g.lptRotor.stages.map((s) => ({ y: s.y, rIn: g.lptRotor.discRIn, rOut: s.r, half: g.lptRotor.discHalf }))),
      ...bladeRows(g.lptRotor.stages.map((s) => ({ y: s.y, n: g.lptRotor.blade.n, rHub: g.lptRotor.blade.rHub, rTip: s.r, chord: g.lptRotor.blade.chord, thick: g.lptRotor.blade.thick, twist: g.lptRotor.blade.twist }))),
    ];
    case 19: return [
      { kind: 'cylinder', y0: g.lpShaft.y0, y1: g.lpShaft.y1, r: g.lpShaft.r },
    ];
    case 20: return [
      { kind: 'annulus', y0: g.hpShaft.y0, y1: g.hpShaft.y1, rIn: g.hpShaft.rIn, rOut: g.hpShaft.rOut },
    ];
    case 21: return [
      { kind: 'cylinder', y0: g.bearings.house.y0, y1: g.bearings.house.y1, r: g.bearings.house.r },
      { kind: 'annulus', y0: g.bearings.ring.y - g.bearings.ring.half, y1: g.bearings.ring.y + g.bearings.ring.half, rIn: g.bearings.ring.rIn, rOut: g.bearings.ring.rOut },
      ...bladeRows([{
        y: g.bearings.struts.y, n: g.bearings.struts.n, rHub: g.bearings.struts.rHub, rTip: g.bearings.struts.rTip,
        chord: g.bearings.struts.chord, thick: g.bearings.struts.thick, twist: 0,
      }]),
    ];
    case 22: return [
      { kind: 'annulus', y0: g.exhaustNozzle.wall.y0, y1: g.exhaustNozzle.wall.y1, rIn: g.exhaustNozzle.wall.rIn, rOut: g.exhaustNozzle.wall.rOut },
      { kind: 'cone', y0: g.exhaustNozzle.tailCone.y0, y1: g.exhaustNozzle.tailCone.y1, r0: g.exhaustNozzle.tailCone.r0, r1: g.exhaustNozzle.tailCone.r1 },
    ];
    case 23: return [
      { kind: 'box', c: g.gearbox.c, size: g.gearbox.size },
    ];
    case 24: return [
      { kind: 'annulus', y0: g.bypassDuct.y0, y1: g.bypassDuct.y1, rIn: g.bypassDuct.rIn, rOut: g.bypassDuct.rOut },
    ];
    default: throw new Error('unknown part id ' + id);
  }
}

/** 点是否在实体内部（p 为世界坐标，实体已在装配位姿） */
export function containsPoint(s: SolidPrim, x: number, y: number, z: number): boolean {
  const r = Math.hypot(x, z);
  switch (s.kind) {
    case 'annulus':
      return y >= s.y0 && y <= s.y1 && r >= s.rIn && r <= s.rOut;
    case 'cylinder':
      return y >= s.y0 && y <= s.y1 && r <= s.r;
    case 'cone': {
      if (y < s.y0 || y > s.y1) return false;
      const t = (y - s.y0) / Math.max(1e-9, s.y1 - s.y0);
      return r <= s.r0 + (s.r1 - s.r0) * t;
    }
    case 'disc':
      return Math.abs(y - s.y) <= s.half && r >= s.rIn && r <= s.rOut;
    case 'torusRing': {
      const d = Math.hypot(Math.hypot(x, z) - s.rRing, y - s.cy);
      return d <= s.rTube;
    }
    case 'bladeRow': {
      if (y < s.y - s.chord / 2 || y > s.y + s.chord / 2) return false;
      if (r < s.rHub || r > s.rTip) return false;
      const theta = Math.atan2(z, x);
      const sector = (Math.PI * 2) / s.n;
      let dTheta = Math.abs(((theta % sector) + sector) % sector);
      if (dTheta > sector / 2) dTheta = sector - dTheta;
      return dTheta * r <= s.thick / 2;
    }
    case 'box':
      return (
        Math.abs(x - s.c[0]) <= s.size[0] / 2 &&
        Math.abs(y - s.c[1]) <= s.size[1] / 2 &&
        Math.abs(z - s.c[2]) <= s.size[2] / 2
      );
    default:
      return false;
  }
}

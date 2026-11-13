import { describe, it, expect } from 'vitest';
import {
  clampProgress, integrateProgress, derivePlayButton, deriveReverseButton,
  deriveReassembleButton, togglePlay, pressReverse, startReassemble,
  selectMode, toggleHidden, toggleIsolate, showAll,
  deriveVisibleIds, deriveOpacity, CoreState,
} from '../src/state/reducer';
import { PARTS } from '../src/data/parts';

const S = (patch: Partial<CoreState> = {}): CoreState => ({
  progress: 0, playing: false, direction: 1, reassembling: false, ...patch,
});

describe('progress 边界钳制', () => {
  it('clampProgress', () => {
    expect(clampProgress(-0.2)).toBe(0);
    expect(clampProgress(1.4)).toBe(1);
    expect(clampProgress(0.55)).toBe(0.55);
  });
});

describe('积分 integrateProgress', () => {
  it('到达 1 自动停', () => {
    const r = integrateProgress(S({ progress: 0.98, playing: true }), 1, 1);
    expect(r.progress).toBe(1);
    expect(r.playing).toBe(false);
  });
  it('到达 0 自动停并结束重装配', () => {
    const r = integrateProgress(S({ progress: 0.02, playing: true, direction: -1, reassembling: true }), 1, 1);
    expect(r.progress).toBe(0);
    expect(r.playing).toBe(false);
    expect(r.reassembling).toBe(false);
  });
  it('暂停不改变 progress', () => {
    const r = integrateProgress(S({ progress: 0.5, playing: false }), 1, 1);
    expect(r.progress).toBe(0.5);
  });
  it('反向积分', () => {
    const r = integrateProgress(S({ progress: 0.5, playing: true, direction: -1 }), 0.1, 1);
    expect(r.progress).toBeCloseTo(0.4);
  });
});

describe('播放/暂停/反向/重装配按钮态', () => {
  it('progress=1 时正向播放禁用', () => {
    expect(derivePlayButton(S({ progress: 1 })).disabled).toBe(true);
  });
  it('progress=0 时反向播放禁用', () => {
    expect(derivePlayButton(S({ progress: 0, direction: -1 })).disabled).toBe(true);
  });
  it('中途播放中显示暂停', () => {
    const b = derivePlayButton(S({ progress: 0.4, playing: true }));
    expect(b.disabled).toBe(false);
    expect(b.label).toBe('暂停');
  });
  it('端点反向禁用、重装配中禁用', () => {
    expect(deriveReverseButton(S({ progress: 0 })).disabled).toBe(true);
    expect(deriveReverseButton(S({ progress: 0.5 })).disabled).toBe(false);
    expect(deriveReverseButton(S({ progress: 0.5, reassembling: true })).disabled).toBe(true);
  });
  it('重装配按钮：0 禁用、进行中 loading', () => {
    expect(deriveReassembleButton(S({ progress: 0 })).disabled).toBe(true);
    expect(deriveReassembleButton(S({ progress: 0.5 })).disabled).toBe(false);
    expect(deriveReassembleButton(S({ progress: 0.5, reassembling: true })).loading).toBe(true);
  });
  it('togglePlay 端点无效、中途翻转', () => {
    expect(togglePlay(S({ progress: 1 })).playing).toBe(false);
    expect(togglePlay(S({ progress: 0.5 })).playing).toBe(true);
  });
  it('pressReverse 任意进度可反向，0 处无效', () => {
    expect(pressReverse(S({ progress: 0.7 }))).toMatchObject({ direction: -1, playing: true });
    expect(pressReverse(S({ progress: 0 }))).toMatchObject({ playing: false });
  });
  it('startReassemble 平滑回 0', () => {
    const r = startReassemble(S({ progress: 0.6, direction: 1, playing: true }));
    expect(r).toMatchObject({ direction: -1, playing: true, reassembling: true, progress: 0.6 });
  });
});

describe('顶栏模式切换', () => {
  it('assembly：progress>0 时平滑回 0', () => {
    const r = selectMode(S({ progress: 0.5, direction: 1 }), 'assembly');
    expect(r).toMatchObject({ direction: -1, playing: true, reassembling: true, progress: 0.5 });
  });
  it('assembly：已在 0 时静置', () => {
    const r = selectMode(S({ progress: 0, playing: true }), 'assembly');
    expect(r).toMatchObject({ playing: false, progress: 0 });
  });
  it('explode：保持当前 progress，停止积分', () => {
    const r = selectMode(S({ progress: 0.4, playing: true, direction: -1 }), 'explode');
    expect(r).toMatchObject({ progress: 0.4, playing: false, direction: 1 });
  });
  it('section：progress 保持不变', () => {
    const r = selectMode(S({ progress: 0.77, playing: true }), 'section');
    expect(r).toMatchObject({ progress: 0.77 });
  });
});

describe('显隐与隔离', () => {
  it('toggleHidden 增删', () => {
    let s = toggleHidden({ selectedId: null, isolatedId: null, hiddenIds: [] }, 3);
    expect(s.hiddenIds).toEqual([3]);
    s = toggleHidden(s, 3);
    expect(s.hiddenIds).toEqual([]);
  });
  it('toggleIsolate 切换/取消', () => {
    let s = toggleIsolate({ selectedId: null, isolatedId: null, hiddenIds: [] }, 13);
    expect(s.isolatedId).toBe(13);
    s = toggleIsolate(s, 13);
    expect(s.isolatedId).toBeNull();
  });
  it('showAll 清空隐藏与隔离', () => {
    const s = showAll({ selectedId: null, isolatedId: 13, hiddenIds: [1, 2] });
    expect(s.isolatedId).toBeNull();
    expect(s.hiddenIds).toEqual([]);
  });
  it('deriveVisibleIds 返回未隐藏 id 并保持编号顺序', () => {
    const s = { selectedId: null, isolatedId: null, hiddenIds: [2, 7] };
    const vis = deriveVisibleIds(s);
    expect(vis).not.toContain(2);
    expect(vis).not.toContain(7);
    expect(vis.length).toBe(PARTS.length - 2);
    expect([...vis].sort((a, b) => a - b)).toEqual(vis);
  });
  it('deriveOpacity：隔离 0.05 / 聚焦淡化 0.25 / 隐藏 0', () => {
    const base = { selectedId: null as number | null, isolatedId: null as number | null, hiddenIds: [] as number[] };
    expect(deriveOpacity({ ...base, isolatedId: 13 }, 5, false)).toBe(0.05);
    expect(deriveOpacity({ ...base, isolatedId: 13 }, 13, false)).toBe(1);
    expect(deriveOpacity({ ...base, selectedId: 9 }, 3, true)).toBe(0.25);
    expect(deriveOpacity({ ...base, hiddenIds: [3] }, 3, false)).toBe(0);
  });
});

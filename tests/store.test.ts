// ============================================================================
// Store 封装层测试：模式持久化 + 滑块拖动挂起/恢复（曾出 bug 的路径回归防护）
// ============================================================================
import { describe, it, expect } from 'vitest';
import { Store, initialState } from '../src/state/store';

const fresh = (): Store => new Store();

describe('Store.selectMode 模式持久化', () => {
  it('explode：写入 mode 且不被 reducer 全量展开的旧 mode 覆盖', () => {
    const s = fresh();
    s.selectMode('explode');
    expect(s.get().mode).toBe('explode');
    expect(s.get().direction).toBe(1);
    expect(s.get().playing).toBe(false);
    expect(s.get().reassembling).toBe(false);
  });

  it('assembly：direction=-1，progress>0 时 playing/reassembling 为 true', () => {
    const s = fresh();
    s.set({ progress: 0.8 });
    s.selectMode('explode');
    s.selectMode('assembly');
    expect(s.get().mode).toBe('assembly');
    expect(s.get().direction).toBe(-1);
    expect(s.get().playing).toBe(true);
    expect(s.get().reassembling).toBe(true);
  });

  it('section：保持 progress，只清 reassembling', () => {
    const s = fresh();
    s.set({ progress: 0.5, reassembling: true, playing: true });
    s.selectMode('section');
    expect(s.get().mode).toBe('section');
    expect(s.get().progress).toBe(0.5);
    expect(s.get().reassembling).toBe(false);
  });
});

describe('滑块拖动挂起/恢复', () => {
  it('grabSlider 挂起积分并记住原 playing', () => {
    const s = fresh();
    s.set({ progress: 0.5 });
    s.togglePlay();
    expect(s.get().playing).toBe(true);
    s.grabSlider();
    expect(s.get().dragging).toBe(true);
    expect(s.get().playing).toBe(false);
    expect(s.get().preDragPlaying).toBe(true);
  });

  it('releaseSlider 恢复挂起前的 playing', () => {
    const s = fresh();
    s.set({ progress: 0.5 });
    s.togglePlay();
    s.grabSlider();
    s.releaseSlider();
    expect(s.get().dragging).toBe(false);
    expect(s.get().playing).toBe(true);
    expect(s.get().preDragPlaying).toBe(false);
  });

  it('拖动期间 setProgress 不破坏 dragging/preDragPlaying', () => {
    const s = fresh();
    s.set({ progress: 0.5 });
    s.togglePlay();
    s.grabSlider();
    s.setProgress(0.75);
    expect(s.get().progress).toBe(0.75);
    expect(s.get().dragging).toBe(true);
    expect(s.get().preDragPlaying).toBe(true);
  });
});

describe('store 单一实例回归', () => {
  it('initialState 不被实例修改污染', () => {
    expect(initialState.mode).toBe('assembly');
    expect(initialState.progress).toBe(0);
  });
});

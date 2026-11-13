// ============================================================================
// 状态机纯函数：播放/滑块/模式/选择/显隐 动作与按钮态推导（vitest 覆盖）
// ============================================================================
import { PARTS } from '../data/parts';
import { clamp01 } from '../three/explode';

export type Mode = 'assembly' | 'explode' | 'section';
export type Direction = 1 | -1;

export interface CoreState {
  progress: number;
  playing: boolean;
  direction: Direction;
  reassembling: boolean;
}

export interface SelectState {
  selectedId: number | null;
  isolatedId: number | null;
  hiddenIds: number[];
}

export const clampProgress = clamp01;

/** 积分一步：到达 0/1 自动停止 */
export function integrateProgress(
  s: CoreState,
  dt: number,
  speed: number,
): CoreState {
  if (!s.playing) return s;
  const next = s.progress + s.direction * speed * dt;
  if (next >= 1) return { ...s, progress: 1, playing: false, reassembling: false };
  if (next <= 0) return { ...s, progress: 0, playing: false, reassembling: false };
  return { ...s, progress: next };
}

export interface PlayButton {
  disabled: boolean;
  playing: boolean;
  icon: string;
  label: string;
}

/** 播放按钮态推导 */
export function derivePlayButton(s: CoreState): PlayButton {
  if (s.reassembling) return { disabled: true, playing: false, icon: '▶', label: '装配中' };
  const atEnd = (s.direction === 1 && s.progress >= 1) || (s.direction === -1 && s.progress <= 0);
  if (atEnd) {
    return { disabled: true, playing: false, icon: '■', label: s.direction === 1 ? '已分解' : '已装配' };
  }
  if (s.playing) return { disabled: false, playing: true, icon: '⏸', label: '暂停' };
  return { disabled: false, playing: false, icon: '▶', label: s.direction === 1 ? '播放' : '反向播放' };
}

/** 反向按钮：progress≤0 时禁用 */
export function deriveReverseButton(s: CoreState): { disabled: boolean } {
  return { disabled: s.reassembling || s.progress <= 0 };
}

/** 重新装配按钮态推导 */
export function deriveReassembleButton(s: CoreState): { disabled: boolean; loading: boolean } {
  return { disabled: s.progress <= 0, loading: s.reassembling };
}

/** 播放/暂停/继续 同一按钮 */
export function togglePlay(s: CoreState): CoreState {
  const atEnd = (s.direction === 1 && s.progress >= 1) || (s.direction === -1 && s.progress <= 0);
  if (atEnd || s.reassembling) return s;
  return { ...s, playing: !s.playing };
}

/** 反向：direction=-1 且 playing=true */
export function pressReverse(s: CoreState): CoreState {
  if (s.progress <= 0 || s.reassembling) return s;
  return { ...s, direction: -1, playing: true };
}

/** 重新装配：从当前进度平滑回 0 */
export function startReassemble(s: CoreState): CoreState {
  if (s.progress <= 0 || s.reassembling) return s;
  return { ...s, direction: -1, playing: true, reassembling: true };
}

/** 顶栏模式切换（不得重建场景；由 UI 层保证） */
export function selectMode(
  s: CoreState,
  mode: Mode,
): CoreState {
  switch (mode) {
    case 'assembly':
      // 装配 = 确保 progress 归 0（不在 0 则平滑回 0）
      return {
        ...s,
        direction: -1,
        playing: s.progress > 0,
        reassembling: s.progress > 0,
      };
    case 'explode':
      // 分解 = 保持当前 progress，停止自动积分，正向播放
      return { ...s, direction: 1, playing: false, reassembling: false };
    case 'section':
      // 剖切 = 保持任意 progress（与分解叠加）
      return { ...s, reassembling: false };
    default:
      return s;
  }
}

/** 滑块直接写 progress（拖动期间由调用方先挂起积分） */
export function setProgress(s: CoreState, progress: number): CoreState {
  return { ...s, progress: clampProgress(progress) };
}

/** 完成重装配（progress 到达 0 后调用） */
export function finishReassemble(s: CoreState): CoreState {
  return { ...s, playing: false, reassembling: false, direction: 1 };
}

// ---------------------------------------------------------------------------
// 选择 / 显隐 / 隔离（纯推导）
// ---------------------------------------------------------------------------

export function toggleHidden(s: SelectState, id: number): SelectState {
  const hidden = s.hiddenIds.includes(id)
    ? s.hiddenIds.filter((x) => x !== id)
    : [...s.hiddenIds, id];
  return { ...s, hiddenIds: hidden };
}

export function toggleIsolate(s: SelectState, id: number): SelectState {
  return { ...s, isolatedId: s.isolatedId === id ? null : id };
}

export function clearIsolation(s: SelectState): SelectState {
  return { ...s, isolatedId: null };
}

export function showAll(s: SelectState): SelectState {
  return { ...s, hiddenIds: [], isolatedId: null };
}

/** 可见零件 id 列表（保持编号顺序） */
export function deriveVisibleIds(s: SelectState): number[] {
  const hidden = new Set(s.hiddenIds);
  return PARTS.filter((p) => !hidden.has(p.id)).map((p) => p.id);
}

/** 有效不透明度：隔离(0.05) / 聚焦淡化(0.25) / 隐藏(0) */
export function deriveOpacity(
  s: SelectState,
  id: number,
  focusFade: boolean,
): number {
  if (s.hiddenIds.includes(id)) return 0;
  if (s.isolatedId !== null && s.isolatedId !== id) return 0.05;
  if (focusFade && s.selectedId !== null && s.selectedId !== id) return 0.25;
  return 1;
}

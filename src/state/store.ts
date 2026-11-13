// ============================================================================
// 唯一状态源 + 订阅通知（薄封装，动作全部走 reducer 纯函数）
// ============================================================================
import {
  CoreState, Mode, SelectState,
  integrateProgress, togglePlay, pressReverse, startReassemble,
  selectMode, setProgress, toggleHidden, toggleIsolate, clearIsolation, showAll,
  clampProgress,
} from './reducer';

export interface AppState extends CoreState, SelectState {
  speed: number;
  mode: Mode;
  clipEnabled: boolean;
  clipOffset: number;
  airflow: boolean;
  labelsVisible: boolean;
  glow: boolean;
  dust: boolean;
  focusFade: boolean;
  shadows: boolean;
  autoRotate: boolean;
  /** 滑块拖动中：挂起自动积分 */
  dragging: boolean;
  preDragPlaying: boolean;
}

export const SPEED_FORWARD = 1 / 9;      // 全程 9 s
export const SPEED_REASSEMBLE = 1 / 6.5; // 重新装配 6.5 s

export const initialState: AppState = {
  progress: 0,
  playing: false,
  direction: 1,
  speed: SPEED_FORWARD,
  reassembling: false,
  mode: 'assembly',
  clipEnabled: false,
  clipOffset: 0.15,
  airflow: false,
  labelsVisible: true,
  glow: true,
  dust: true,
  focusFade: false,
  shadows: true,
  autoRotate: false,
  selectedId: null,
  isolatedId: null,
  hiddenIds: [],
  dragging: false,
  preDragPlaying: false,
};

type Listener = (s: AppState) => void;

export class Store {
  private state: AppState = { ...initialState };
  private listeners = new Set<Listener>();

  get(): AppState {
    return this.state;
  }

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  // ---- 动作（直接调用 reducer 纯函数） ----
  tick(dt: number): void {
    const s = integrateProgress(this.state, dt, this.state.speed);
    const changed =
      s.progress !== this.state.progress || s.playing !== this.state.playing ||
      s.reassembling !== this.state.reassembling;
    if (changed) this.set(s);
  }

  togglePlay(): void { this.set(togglePlay(this.state)); }
  pressReverse(): void { this.set(pressReverse(this.state)); }
  startReassemble(): void { this.set(startReassemble(this.state)); }
  selectMode(mode: Mode): void {
    // reducer 整体展开 this.state（AppState 携带旧 mode），必须删掉再显式写入新模式
    const patch = selectMode(this.state, mode) as Partial<AppState>;
    delete patch.mode;
    this.set({ mode, ...patch });
  }
  setProgress(p: number): void {
    this.set(setProgress(this.state, p));
  }
  /** 滑块 pointerdown：挂起积分 */
  grabSlider(): void {
    this.set({ dragging: true, preDragPlaying: this.state.playing, playing: false });
  }
  /** 滑块 pointerup：恢复挂起前的 playing */
  releaseSlider(): void {
    this.set({ dragging: false, playing: this.state.preDragPlaying, preDragPlaying: false });
  }
  setClipOffset(v: number): void {
    this.set({ clipOffset: clampProgress((v + 1.3) / 2.6) * 2.6 - 1.3 });
  }
  toggleHidden(id: number): void { this.set(toggleHidden(this.state, id)); }
  toggleIsolate(id: number): void { this.set(toggleIsolate(this.state, id)); }
  clearIsolation(): void { this.set(clearIsolation(this.state)); }
  showAll(): void { this.set(showAll(this.state)); }
}

export const store = new Store();

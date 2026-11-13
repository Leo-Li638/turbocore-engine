// ============================================================================
// 底部控制条：播放/反向/重新装配按钮态（纯推导）、进度滑块（挂起积分）、五段刻度
// ============================================================================
import { $, el } from './dom';
import { SEGMENTS } from '../data/parts';
import { store, type AppState } from '../state/store';
import { derivePlayButton, deriveReverseButton, deriveReassembleButton } from '../state/reducer';

export interface BottomBarEvents {
  onResetView(): void;
  onSectionView(): void;
}

export class BottomBar {
  constructor(events: BottomBarEvents) {
    $('#btn-play').addEventListener('click', () => store.togglePlay());
    $('#btn-reverse').addEventListener('click', () => store.pressReverse());
    $('#btn-reassemble').addEventListener('click', () => store.startReassemble());
    $('#btn-reset-view2').addEventListener('click', () => events.onResetView());
    $('#btn-section-view').addEventListener('click', () => events.onSectionView());

    // 进度滑块：pointerdown 挂起积分（撤销由 releaseSlider 恢复）
    const slider = $('#progress-slider') as HTMLInputElement;
    slider.addEventListener('pointerdown', () => store.grabSlider());
    slider.addEventListener('pointerup', () => store.releaseSlider());
    slider.addEventListener('pointercancel', () => store.releaseSlider());
    slider.addEventListener('input', () => store.setProgress(parseFloat(slider.value) / 100));

    // 五段刻度 + 段名
    const marks = $('#seg-marks');
    const row = $('#seg-row');
    for (const seg of SEGMENTS) {
      const mark = el('span', 'seg-mark');
      mark.style.left = `${seg.t * 100}%`;
      marks.appendChild(mark);
      row.appendChild(el('span', '', seg.label));
    }

    store.subscribe((s) => this.render(s));
    this.render(store.get());
  }

  private render(s: AppState): void {
    const play = derivePlayButton(s);
    const playBtn = $('#btn-play') as HTMLButtonElement;
    playBtn.disabled = play.disabled;
    playBtn.classList.toggle('playing', play.playing);
    $('#play-icon').textContent = play.icon;
    $('#play-label').textContent = play.label;

    ($('#btn-reverse') as HTMLButtonElement).disabled = deriveReverseButton(s).disabled;
    const re = deriveReassembleButton(s);
    const reBtn = $('#btn-reassemble') as HTMLButtonElement;
    reBtn.disabled = re.disabled;
    reBtn.classList.toggle('loading', re.loading);

    $('#progress-pct').textContent = `${Math.round(s.progress * 100)}%`;
    if (!s.dragging) {
      ($('#progress-slider') as HTMLInputElement).value = String(Math.round(s.progress * 100));
    }
  }
}

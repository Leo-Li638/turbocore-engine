// ============================================================================
// 轻提示：CSS 动画自动淡入淡出，JS 在动画结束后移除节点
// ============================================================================
import { $ } from './dom';

export function showToast(message: string, warn = false): void {
  const stack = $('#toast-stack');
  const t = document.createElement('div');
  t.className = warn ? 'toast warn' : 'toast';
  t.textContent = message;
  stack.appendChild(t);
  window.setTimeout(() => t.remove(), 2800);
}

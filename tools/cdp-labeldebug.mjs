// 聚焦调试：文字标签点击是否切换（含事件日志）
import { writeFile } from 'node:fs/promises';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URL = 'http://127.0.0.1:5180/';
async function main() {
  const list = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const evl = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  const metrics = async (w, h, mobile) => { await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); };
  const clickAt = async (x, y) => {
    await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  const rect = async (sel, idx = 0) => evl('(() => { const e = document.querySelectorAll(' + JSON.stringify(sel) + ')[' + idx + ']; if (!e) return null; const r = e.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: r.x, y: r.y, w: r.width, h: r.height }; })()');

  await S('Page.enable'); await S('Runtime.enable');
  await metrics(1366, 900, false);
  await S('Page.navigate', { url: URL });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  await sleep(1500);
  await evl("document.getElementById('display-switches').scrollIntoView({ block: 'center' })");
  await sleep(300);
  await evl("window.__ev = []; document.addEventListener('change', e => window.__ev.push('change ' + e.target.id + '=' + e.target.checked), true); document.addEventListener('click', e => { const t = e.target; window.__ev.push('click ' + (t.tagName || '') + '#' + (t.id || '') + '.' + (t.className || '')); }, true); 'ok'");

  // A) 文字标签 index 4（气流演示）
  const lab = await rect('.switch-row label', 4);
  console.log('label4 rect:', JSON.stringify(lab));
  const before = await evl('JSON.stringify(window.__TC__.snapshot().toggles)');
  await clickAt(lab.cx, lab.cy);
  await sleep(400);
  console.log('A) after text-label click: toggles=', await evl('JSON.stringify(window.__TC__.snapshot().toggles)'), 'events=', await evl('JSON.stringify(window.__ev.slice(-8))'), 'inputChecked=', await evl("document.getElementById('sw-airflow').checked"));
  await evl('window.__ev = []');
  // B) 滑块(.sw)点击 index 4
  const sw = await rect('.switch-row .sw', 4);
  console.log('sw4 rect:', JSON.stringify(sw));
  await clickAt(sw.cx, sw.cy);
  await sleep(400);
  console.log('B) after .sw click: toggles=', await evl('JSON.stringify(window.__TC__.snapshot().toggles)'), 'events=', await evl('JSON.stringify(window.__ev.slice(-8))'), 'inputChecked=', await evl("document.getElementById('sw-airflow').checked"));

  // C) 恢复：用键盘/程序复位（关闭气流）
  await evl("(function(){ const i = document.getElementById('sw-airflow'); if (i.checked) { i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); } })()");
  await sleep(200);
  console.log('C) restored:', await evl('JSON.stringify(window.__TC__.snapshot().toggles)'));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
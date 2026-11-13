// 验证单文件版能否用 file:// 直接打开（无需服务器）
import { writeFile } from 'node:fs/promises';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'E:\\developer-file\\dev\\DeepseekHarness\\work\\turbocore-engine\\tests\\screenshots';
const TARGET = 'file:///E:/Apps/turbocore/TURBOCORE.html';

async function main() {
  const list = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = []; const logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' :: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (m.params.type === 'error') errors.push(txt);
      else logs.push(m.params.type + ': ' + txt);
    }
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const evl = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  await S('Page.enable'); await S('Runtime.enable');
  await S('Page.bringToFront');
  await S('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url: TARGET });
  let boot = false;
  for (let i = 0; i < 40; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('file:// boot:', boot);
  if (boot) {
    await evl('window.__TC__.explode()'); await sleep(200);
    await evl('window.__TC__.setProgress(1)'); await sleep(1500);
    const s = await evl('window.__TC__.snapshot()');
    console.log('snapshot:', JSON.stringify({ progress: s.progress, mode: s.mode, tris: s.tris, calls: s.calls, toggles: s.toggles, visible: s.visibleParts }));
    const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' });
    await writeFile(OUT + '\\filetest_exploded.png', Buffer.from(data, 'base64'));
    const probe = await evl("(() => { const c = document.querySelector('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return { canvas: [c.width, c.height], webgl: !!g, bodyText: document.body.innerText.slice(0, 80) }; })()");
    console.log('probe:', JSON.stringify(probe));
  }
  console.log('LOGS:', JSON.stringify(logs.slice(0, 12)));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 12)));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

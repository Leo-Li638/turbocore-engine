import { writeFile, mkdir } from 'node:fs/promises';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'E:\\developer-file\\dev\\DeepseekHarness\\work\\turbocore-engine\\tests\\screenshots';
await mkdir(OUT, { recursive: true });
async function main() {
  const list = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
      errors.push(m.params.type.toUpperCase() + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400));
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const evl = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return 'EVALFAIL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300);
    return r.result?.result?.value;
  };
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url: 'http://127.0.0.1:5180/' });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  await sleep(2000);
  const snap1 = await evl('window.__TC__.snapshot()');
  console.log('snap1:', JSON.stringify(snap1));
  await sleep(1500);
  const snap2 = await evl('window.__TC__.snapshot()');
  console.log('snap2:', JSON.stringify(snap2));
  // direct renderer probe
  const probe = await evl("JSON.stringify({canvasW: (document.querySelector('#viewport canvas')||{}).width, canvasH: (document.querySelector('#viewport canvas')||{}).height, gl: (() => { try { const c = document.querySelector('#viewport canvas'); return c ? !!(c.getContext('webgl2') || c.getContext('webgl')) : 'no-canvas'; } catch(e) { return 'err:' + e.message; } })()})");
  console.log('probe:', probe);
  const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' });
  await writeFile(OUT + '\\diag_assembly.png', Buffer.from(data, 'base64'));
  console.log('diag shot saved');
  console.log('ERRORS:', JSON.stringify(errors, null, 1).slice(0, 4000));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

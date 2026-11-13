// CDP evidence script for turbocore-engine (zero deps, Node >= 22 global WebSocket)
// Usage: node tools/cdp-shots.mjs
import { writeFile } from 'node:fs/promises';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'E:\\developer-file\\dev\\DeepseekHarness\\work\\turbocore-engine\\tests\\screenshots';
const URL = 'http://127.0.0.1:5180/';

async function main() {
  const list = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const evl = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' });
    await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64'));
    console.log('shot', name);
  };
  const metrics = async (w, h, mobile) => { await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); };

  await S('Page.enable'); await S('Runtime.enable');
  await metrics(1366, 900, false);
  await S('Page.navigate', { url: URL });

  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  if (!boot) { console.log('errors so far:', JSON.stringify(errors)); process.exit(1); }
  await sleep(2500);

  console.log('state:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await shot('tc_01_assembly');

  await evl('window.__TC__.explode()'); await sleep(600);
  console.log('exploded:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await shot('tc_02_exploded');

  // 2b. 25% / 75% 确定性位置证据（同一 progress 反复停位一致）
  await evl('window.__TC__.setProgress(0.25)'); await sleep(700);
  await shot('tc_09_progress25');
  await evl('window.__TC__.setProgress(0.75)'); await sleep(700);
  await shot('tc_10_progress75');
  await evl('window.__TC__.setProgress(1)'); await sleep(500);

  await evl('window.__TC__.setProgress(0.5); window.__TC__.toggleClip()'); await sleep(600);
  console.log('section:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await shot('tc_03_section');

  await evl('window.__TC__.toggleClip(); window.__TC__.setProgress(1); window.__TC__.selectPart(12)'); await sleep(900);
  console.log('selected:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await shot('tc_04_selected_preview');

  // 5. isolate part 12 (focus-fade demo) via debug API
  await evl('window.__TC__.selectPart(12); window.__TC__.iso(12)'); await sleep(700);
  await shot('tc_05_isolated');

  // 5b. label display probe (which labels are hidden & why)
  const lbl = await evl("JSON.stringify(Array.from(document.querySelectorAll('.tc-label')).filter(e => getComputedStyle(e).display === 'none' || e.style.display === 'none').map(e => e.dataset.partId + ':' + e.style.display + '/' + getComputedStyle(e).display))");
  console.log('hiddenLabels:', lbl);
  await evl('window.__TC__.iso(12)'); await sleep(300);

  // 5c. glow OFF -> renderer.info reflects pure scene (draw-call budget evidence)
  await evl('window.__TC__.setGlow(false)'); await sleep(1200);
  console.log('scene-only:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await evl('window.__TC__.setGlow(true)'); await sleep(1200);

  // 5d. airflow ON -> perf with airflow layer + 视觉证据
  await evl('window.__TC__.setAirflow(true)'); await sleep(1600);
  console.log('airflow:', JSON.stringify(await evl('window.__TC__.snapshot()')));
  await shot('tc_11_airflow');
  await evl('window.__TC__.setAirflow(false)'); await sleep(400);

  await metrics(375, 812, true); await sleep(900);
  const m375 = await evl("JSON.stringify({innerWidth: innerWidth, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, visibleLabels: Array.from(document.querySelectorAll('.tc-label')).filter(e => e.style.display !== 'none' && getComputedStyle(e).display !== 'none').length, totalLabels: document.querySelectorAll('.tc-label').length})");
  console.log('m375:', m375);
  await shot('tc_06_mobile375');

  await metrics(768, 1024, true); await sleep(900);
  const m768 = await evl("JSON.stringify({innerWidth: innerWidth, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, visibleLabels: Array.from(document.querySelectorAll('.tc-label')).filter(e => e.style.display !== 'none' && getComputedStyle(e).display !== 'none').length})");
  console.log('m768:', m768);
  await shot('tc_07_mobile768');

  await metrics(1366, 900, false); await sleep(400);
  await evl("document.getElementById('btn-help').click()"); await sleep(500);
  await shot('tc_08_help_modal');
  await evl("document.getElementById('btn-help-close').click()"); await sleep(200);

  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

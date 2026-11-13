// CDP v5：确定性英雄图（直接 setProgress，不依赖动画计时）+ 面板特写 + 移动端
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
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
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
  const shotFull = async (name) => { const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' }); await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64')); };
  const shotClip = async (name, clip) => { const { result: { data } } = await S('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } }); await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64')); };

  await S('Page.enable'); await S('Runtime.enable');
  await S('Page.bringToFront');
  await S('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url: URL });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  if (!boot) { console.log('errors:', JSON.stringify(errors)); process.exit(1); }
  await sleep(1600);
  const fps = await evl("(() => { window.__f = 0; const t0 = performance.now(); const tick = () => { window.__f++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()");
  await sleep(1400);
  console.log('rAF fps ~', await evl('window.__f'));

  // 1) 装配态 0%
  await evl('window.__TC__.assemble()'); await sleep(200);
  await evl('window.__TC__.setProgress(0)'); await sleep(1200);
  console.log('assembly:', JSON.stringify({ p: (await evl('window.__TC__.snapshot()')).progress }));
  await shotFull('hero_01_assembly');

  // 2) 完全分解 100%
  await evl('window.__TC__.explode()'); await sleep(200);
  await evl('window.__TC__.setProgress(1)'); await sleep(1600);
  console.log('exploded:', JSON.stringify({ p: (await evl('window.__TC__.snapshot()')).progress }));
  await shotFull('hero_02_exploded');

  // 3) 分解 + 气流演示
  await evl('window.__TC__.setAirflow(true)'); await sleep(1500);
  await shotFull('hero_03_exploded_airflow');
  await evl('window.__TC__.setAirflow(false)'); await sleep(400);

  // 4) 剖切视图（装配态）
  await evl('window.__TC__.assemble()'); await sleep(200);
  await evl('window.__TC__.setProgress(0)'); await sleep(600);
  await evl('window.__TC__.toggleClip()'); await sleep(1200);
  const sClip = await evl('window.__TC__.snapshot()');
  console.log('section:', JSON.stringify({ clip: sClip.clipEnabled, sceneClip: sClip.scene.clip, offset: sClip.clipOffset, mode: sClip.mode }));
  await shotFull('hero_04_section');
  await evl('window.__TC__.toggleClip()'); await sleep(500);
  await evl('window.__TC__.assemble()'); await sleep(200);

  // 5) 选中零件检视（右侧详情）
  await evl('window.__TC__.selectPart(12)'); await sleep(800);
  await shotFull('hero_05_part_inspector');
  await evl('window.__TC__.selectPart(null)'); await sleep(400);

  // 6) 面板特写（剖切关闭态：滑块置灰但常驻）
  const panel = await evl("(() => { const b = document.getElementById('clip-slider-box'); const sw = document.getElementById('display-switches'); const r = sw.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return { x: Math.max(0, Math.round(r.x) - 10), y: Math.max(0, Math.round(r.y) - 34), width: Math.round(r.width) + 20, height: Math.round(rb.bottom - r.y) + 44 }; })()");
  await shotClip('v5_panel', panel);
  console.log('panel:', JSON.stringify(panel));

  // 7) 移动端 390x844
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(1200);
  await shotFull('mobile_01_assembly');
  const mob = await evl("(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth, bodyH: document.body.scrollHeight, winH: innerHeight }))()");
  console.log('mobile overflow:', JSON.stringify(mob));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

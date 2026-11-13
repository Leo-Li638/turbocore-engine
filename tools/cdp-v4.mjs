// CDP v4：视口裁剪像素对比（排除 UI 面板）+ 首页用英雄图
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
  const shotFull = async (name) => {
    const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' });
    await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64'));
  };
  const shotClip = async (name, clip) => {
    const { result: { data } } = await S('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64'));
  };
  const rect = async (sel) => evl("(() => { const e = document.querySelector('" + sel + "'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()");

  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url: URL });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  if (!boot) { console.log('errors:', JSON.stringify(errors)); process.exit(1); }
  await sleep(1800);

  const vp = await rect('#viewport');
  console.log('viewport rect:', JSON.stringify(vp));

  // ---- 拆解到 100%，气流粒子在壳体打开后才可见 ----
  await evl('window.__TC__.explode()');
  await sleep(2200);
  const sExp = await evl('window.__TC__.snapshot()');
  console.log('exploded progress:', sExp.progress, 'mode:', sExp.mode);

  // airflow off/on（只裁视口）
  await evl('window.__TC__.setAirflow(false)'); await sleep(700);
  await shotClip('v4_af_off', vp);
  await evl('window.__TC__.setAirflow(true)'); await sleep(1200);
  await shotClip('v4_af_on', vp);
  const afScene = (await evl('window.__TC__.snapshot()')).scene;
  console.log('airflow scene flag:', afScene.airflow);

  // dust off/on（只裁视口）
  await evl('window.__TC__.setAirflow(false)');
  await evl("document.querySelectorAll('.switch-row')[3].querySelector('input').click()"); await sleep(700);
  await shotClip('v4_du_off', vp);
  await evl("document.querySelectorAll('.switch-row')[3].querySelector('input').click()"); await sleep(900);
  await shotClip('v4_du_on', vp);
  const duScene = (await evl('window.__TC__.snapshot()')).scene;
  console.log('dust scene flag:', duScene.dust);

  // ---- 首页英雄图（整页，1366x900）----
  await evl('window.__TC__.assemble()'); await sleep(2600);
  const sAsm = await evl('window.__TC__.snapshot()');
  console.log('assembly progress:', sAsm.progress, 'mode:', sAsm.mode);
  await shotFull('hero_01_assembly');

  await evl('window.__TC__.explode()'); await sleep(2400);
  await evl('window.__TC__.setAirflow(true)'); await sleep(1400);
  await shotFull('hero_02_exploded_airflow');
  await evl('window.__TC__.setAirflow(false)'); await sleep(500);
  await shotFull('hero_03_exploded');

  // 剖切视图
  await evl('window.__TC__.assemble()'); await sleep(2600);
  await evl('window.__TC__.toggleClip()'); await sleep(1200);
  const sClip = await evl('window.__TC__.snapshot()');
  console.log('clip:', sClip.clipEnabled, 'scene clip:', sClip.scene.clip, 'offset:', sClip.clipOffset);
  await shotFull('hero_04_section');

  // 面板特写（剖切关闭态，检查置灰与开关排布）
  await evl('window.__TC__.toggleClip()'); await sleep(800);
  const panel = await evl("(() => { const b = document.getElementById('clip-slider-box'); const sw = document.getElementById('display-switches'); const r = sw.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return { x: Math.round(r.x) - 8, y: Math.round(r.y) - 40, width: Math.round(r.width) + 16, height: Math.round(rb.bottom - r.y) + 48 }; })()");
  await shotClip('v4_panel_clipoff', panel);
  console.log('panel crop:', JSON.stringify(panel));

  const sEnd = await evl('window.__TC__.snapshot()');
  console.log('END:', JSON.stringify({ progress: sEnd.progress, mode: sEnd.mode, toggles: sEnd.toggles, scene: sEnd.scene }));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

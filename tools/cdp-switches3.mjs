// CDP 验证 v3：每次点击前重新量坐标；boot 态一致性；剖切面板稳定；滑块真值断言
import { writeFile } from 'node:fs/promises';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'E:\\developer-file\\dev\\DeepseekHarness\\work\\turbocore-engine\\tests\\screenshots';
const URL = 'http://127.0.0.1:5180/';
const KEYS = ['labels', 'clip', 'glow', 'dust', 'airflow', 'focusFade', 'shadows', 'autoRotate'];

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
  const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  const evl = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const { result: { data } } = await S('Page.captureScreenshot', { format: 'png' });
    await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64'));
  };
  const metrics = async (w, h, mobile) => { await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); };
  const clickAt = async (x, y) => {
    await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  const rectExpr = async (expr) => evl('(() => { const e = ' + expr + '; if (!e) return null; const r = e.getBoundingClientRect(); return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), x: r.x, y: r.y, w: r.width, h: r.height }; })()');
  const rowSw = (i) => "document.querySelectorAll('.switch-row')[" + i + "].querySelector('.sw')";
  const snap = async () => evl('window.__TC__.snapshot()');

  // 点击第 i 个开关：先量坐标再点，并用 toggles 断言真的翻转（未翻转则重点一次）
  const clickSwitch = async (i) => {
    const key = KEYS[i];
    const before = await snap();
    const c = await rectExpr(rowSw(i));
    await clickAt(c.cx, c.cy);
    await sleep(500);
    let mid = await snap();
    if (mid.toggles[key] === before.toggles[key]) {
      const c2 = await rectExpr(rowSw(i));
      await clickAt(c2.cx, c2.cy);
      await sleep(500);
      mid = await snap();
    }
    return { before, mid };
  };
  const gridY = async () => (await rectExpr("document.getElementById('display-switches')")).y;

  await S('Page.enable'); await S('Runtime.enable');
  await metrics(1366, 900, false);
  await S('Page.navigate', { url: URL });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  if (!boot) { console.log('errors:', JSON.stringify(errors)); process.exit(1); }
  await sleep(2000);
  await evl("document.getElementById('display-switches').scrollIntoView({ block: 'center' })");
  await sleep(400);

  const s0 = await snap();
  console.log('ROWS:', await evl("JSON.stringify(Array.from(document.querySelectorAll('.switch-row')).map((r,i)=>({i,text:r.querySelector('label')?r.querySelector('label').textContent:'',hasInput:!!r.querySelector('input')})))"));
  console.log('BOOT store:', JSON.stringify(s0.toggles));
  console.log('BOOT scene:', JSON.stringify(s0.scene));
  const bootMismatch = KEYS.filter(k => k !== 'focusFade' && s0.toggles[k] !== s0.scene[k]);
  console.log('BOOT MISMATCH:', JSON.stringify(bootMismatch));
  console.log('clip panel: hidden=', await evl("document.getElementById('clip-slider-box').classList.contains('hidden')"), ' off=', await evl("document.getElementById('clip-slider-box').classList.contains('off')"), ' disabled=', await evl("document.getElementById('clip-slider').disabled"));
  const y0 = await gridY();
  await shot('sw3_00_baseline');

  // ---- 1) 8 个开关逐个：翻转 + 复位（每次都重新量坐标）----
  const results = [];
  for (let i = 0; i < 8; i++) {
    const key = KEYS[i];
    const { before, mid } = await clickSwitch(i);
    const storeFlip = mid.toggles[key] === !before.toggles[key];
    const sceneFlip = key === 'focusFade' ? 'n/a' : (mid.scene[key] === !before.scene[key]);
    const yMid = await gridY();
    const c2 = await rectExpr(rowSw(i));
    await clickAt(c2.cx, c2.cy);
    await sleep(450);
    const back = await snap();
    const storeBack = back.toggles[key] === before.toggles[key];
    const sceneBack = key === 'focusFade' ? 'n/a' : (back.scene[key] === before.scene[key]);
    const yBack = await gridY();
    results.push({ i, key, storeFlip, sceneFlip, storeBack, sceneBack, gridShift: Math.round(Math.max(Math.abs(yMid - y0), Math.abs(yBack - y0))), ok: storeFlip && storeBack && (key === 'focusFade' || (sceneFlip && sceneBack)) });
    console.log('SWITCH', i, key, JSON.stringify(results[results.length - 1]));
  }

  // ---- 2) 文字标签点击（row i 的第一个 label 是文字标签）----
  const labelChecks = [];
  for (const i of [0, 4]) {
    const key = KEYS[i];
    const before = await snap();
    const c = await rectExpr("document.querySelectorAll('.switch-row')[" + i + "].querySelector('label')");
    await clickAt(c.cx, c.cy);
    await sleep(500);
    const mid = await snap();
    const flipped = mid.toggles[key] === !before.toggles[key];
    const c2 = await rectExpr("document.querySelectorAll('.switch-row')[" + i + "].querySelector('label')");
    await clickAt(c2.cx, c2.cy);
    await sleep(400);
    const back = await snap();
    const restored = back.toggles[key] === before.toggles[key];
    labelChecks.push({ i, key, flipped, restored, ok: flipped && restored });
    console.log('LABEL', i, key, JSON.stringify(labelChecks[labelChecks.length - 1]));
  }

  // ---- 3) 配对截图 ----
  const pairShot = async (key, i, onName, offName) => {
    let cur = (await snap()).toggles[key];
    if (cur !== true) { await clickSwitch(i); }
    await sleep(600); await shot(onName);
    await clickSwitch(i); await sleep(600); await shot(offName);
    await clickSwitch(i); await sleep(400);
  };
  await pairShot('labels', 0, 'sw3_10_labels_on', 'sw3_11_labels_off');
  await pairShot('glow', 2, 'sw3_12_glow_on', 'sw3_13_glow_off');
  await pairShot('dust', 3, 'sw3_14_dust_on', 'sw3_15_dust_off');
  await pairShot('shadows', 6, 'sw3_16_shadows_on', 'sw3_17_shadows_off');
  {
    const st0 = await snap();
    if (st0.toggles.airflow) { await clickSwitch(4); await sleep(400); }
    await shot('sw3_18_airflow_off');
    await clickSwitch(4); await sleep(900);
    console.log('airflow on -> store:', (await snap()).toggles.airflow, 'scene:', (await snap()).scene.airflow);
    await shot('sw3_19_airflow_on');
    await clickSwitch(4); await sleep(400);
  }
  // clip：开 -> 面板位置不变 -> 滑块 0.35 生效 -> 关
  {
    const stBefore = await snap();
    if (stBefore.toggles.clip) { await clickSwitch(1); await sleep(400); }
    const yBefore = await gridY();
    await shot('sw3_20_clip_off');
    await clickSwitch(1); await sleep(700);
    const onSt = await snap();
    const yAfter = await gridY();
    console.log('clip on: store', onSt.toggles.clip, 'scene', onSt.scene.clip, 'gridShift', Math.round(yAfter - yBefore));
    await shot('sw3_21_clip_on');
    await evl("(function(){ const s = document.getElementById('clip-slider'); s.value='0.35'; s.dispatchEvent(new Event('input',{bubbles:true})); return true; })()");
    await sleep(600);
    const st = await snap();
    console.log('clip slider: store', st.clipOffset, 'scene', st.scene.clipOffset, 'enabled', !st.scene.clip ? 'clipOFF!' : 'ok', 'sliderDisabled=', await evl("document.getElementById('clip-slider').disabled"));
    await shot('sw3_22_clip_slider');
    await evl("(function(){ const s = document.getElementById('clip-slider'); s.value='0.15'; s.dispatchEvent(new Event('input',{bubbles:true})); return true; })()");
    await sleep(400);
    await clickSwitch(1); await sleep(400);
    console.log('clip off: sliderDisabled=', await evl("document.getElementById('clip-slider').disabled"), ' box off=', await evl("document.getElementById('clip-slider-box').classList.contains('off')"));
  }
  // focusFade
  {
    await evl('window.__TC__.selectPart(12)'); await sleep(700);
    await shot('sw3_23_focusfade_off');
    await clickSwitch(5); await sleep(700);
    await shot('sw3_24_focusfade_on');
    await clickSwitch(5); await sleep(400);
    await evl('window.__TC__.selectPart(null)'); await sleep(400);
  }
  // autoRotate
  {
    const az0 = (await snap()).az;
    await clickSwitch(7); await sleep(4500);
    const az1 = (await snap()).az;
    await clickSwitch(7); await sleep(400);
    console.log('AUTOROTATE az:', az0, '->', az1, 'changed:', az0 !== az1);
    await shot('sw3_25_after_autorotate');
  }
  await sleep(600);
  const sEnd = await snap();
  console.log('FINAL store:', JSON.stringify(sEnd.toggles));
  console.log('FINAL scene:', JSON.stringify(sEnd.scene));
  console.log('FINAL match boot:', JSON.stringify(sEnd.toggles));
  await shot('sw3_99_final');
  console.log('SWITCH RESULTS:', JSON.stringify(results));
  console.log('LABEL RESULTS:', JSON.stringify(labelChecks));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

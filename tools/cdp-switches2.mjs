// CDP 验证 v2：真实点击 8 个开关，断言 store 与真实场景状态同步翻转 + 像素级效果对比
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
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
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
  const rectExpr = async (expr) => evl('(() => { const e = ' + expr + '; if (!e) return null; const r = e.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: r.x, y: r.y, w: r.width, h: r.height }; })()');
  const rowSw = (i) => 'document.querySelectorAll(\'.switch-row\')[' + i + '].querySelector(\'.sw\')';
  const rowLabel = (i) => 'document.querySelectorAll(\'.switch-row\')[' + i + '].querySelector(\'label\')';
  const snap = async () => evl('window.__TC__.snapshot()');

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

  const rows = await evl("JSON.stringify(Array.from(document.querySelectorAll('.switch-row')).map((r, i) => ({ i, text: r.querySelector('label') ? r.querySelector('label').textContent : '', checked: r.querySelector('input') ? r.querySelector('input').checked : null })))");
  console.log('ROWS:', rows);
  const s0 = await snap();
  console.log('initial store toggles:', JSON.stringify(s0.toggles));
  console.log('initial scene state:', JSON.stringify(s0.scene));
  await shot('sw2_00_baseline');

  // ---- 1) 8 个开关：点击 -> toggles 与 scene 同步翻转 -> 再点复位 ----
  const results = [];
  for (let i = 0; i < 8; i++) {
    const key = KEYS[i];
    const before = await snap();
    const c = await rectExpr(rowSw(i));
    await clickAt(c.cx, c.cy);
    await sleep(400);
    const mid = await snap();
    const storeFlip = mid.toggles[key] === !before.toggles[key];
    const sceneFlip = key === 'focusFade' ? 'n/a' : (mid.scene[key] === !before.scene[key]);
    await clickAt(c.cx, c.cy);
    await sleep(350);
    const back = await snap();
    const storeBack = back.toggles[key] === before.toggles[key];
    const sceneBack = key === 'focusFade' ? 'n/a' : (back.scene[key] === before.scene[key]);
    results.push({ i, key, storeFlip, sceneFlip, storeBack, sceneBack, ok: storeFlip && storeBack && (key === 'focusFade' || (sceneFlip && sceneBack)) });
    console.log('SWITCH', i, key, JSON.stringify(results[results.length - 1]));
  }

  // ---- 2) 文字标签点击（每行第一个 label 是文字标签）----
  const labelChecks = [];
  for (const i of [0, 4]) {
    const key = KEYS[i];
    const before = await snap();
    const c = await rectExpr(rowLabel(i));
    await clickAt(c.cx, c.cy);
    await sleep(400);
    const mid = await snap();
    const flipped = mid.toggles[key] === !before.toggles[key];
    await clickAt(c.cx, c.cy);
    await sleep(300);
    const back = await snap();
    const restored = back.toggles[key] === before.toggles[key];
    labelChecks.push({ i, key, flipped, restored, ok: flipped && restored });
    console.log('LABEL', i, key, JSON.stringify(labelChecks[labelChecks.length - 1]));
  }

  // ---- 3) 效果配对截图（同一相机、仅目标开关变化）----
  const pairShot = async (key, i, onName, offName) => {
    const cur = (await snap()).toggles[key];
    if (cur !== true) { const c = await rectExpr(rowSw(i)); await clickAt(c.cx, c.cy); await sleep(400); }
    await sleep(500);
    await shot(onName);
    const c = await rectExpr(rowSw(i)); await clickAt(c.cx, c.cy); await sleep(400);
    await sleep(500);
    await shot(offName);
    const c2 = await rectExpr(rowSw(i)); await clickAt(c2.cx, c2.cy); await sleep(400);
  };
  await pairShot('labels', 0, 'sw2_10_labels_on', 'sw2_11_labels_off');
  await pairShot('glow', 2, 'sw2_12_glow_on', 'sw2_13_glow_off');
  await pairShot('dust', 3, 'sw2_14_dust_on', 'sw2_15_dust_off');
  await pairShot('shadows', 6, 'sw2_16_shadows_on', 'sw2_17_shadows_off');
  // airflow 默认 off：先拍 off，再开拍 on
  {
    await shot('sw2_18_airflow_off');
    const c = await rectExpr(rowSw(4)); await clickAt(c.cx, c.cy); await sleep(700);
    await shot('sw2_19_airflow_on');
    const c2 = await rectExpr(rowSw(4)); await clickAt(c2.cx, c2.cy); await sleep(400);
  }
  // clip：先拍 off，再开拍 on + 滑块
  {
    await shot('sw2_20_clip_off');
    const c = await rectExpr(rowSw(1)); await clickAt(c.cx, c.cy); await sleep(500);
    await shot('sw2_21_clip_on');
    const slider = await evl("(function(){ const s = document.getElementById('clip-slider'); s.value = '0.35'; s.dispatchEvent(new Event('input', { bubbles: true })); return !document.getElementById('clip-slider-box').classList.contains('hidden'); })()");
    await sleep(500);
    const st = await snap();
    console.log('clip slider visible:', slider, 'clipOffset store:', st.clipOffset, 'clipOffset scene:', st.scene.clipOffset);
    await shot('sw2_22_clip_slider');
    const c2 = await rectExpr(rowSw(1)); await clickAt(c2.cx, c2.cy); await sleep(400);
  }
  // focusFade：选中 12 号后对比
  {
    await evl('window.__TC__.selectPart(12)'); await sleep(600);
    await shot('sw2_23_focusfade_off');
    const c = await rectExpr(rowSw(5)); await clickAt(c.cx, c.cy); await sleep(600);
    await shot('sw2_24_focusfade_on');
    const c2 = await rectExpr(rowSw(5)); await clickAt(c2.cx, c2.cy); await sleep(300);
    await evl('window.__TC__.selectPart(null)'); await sleep(300);
  }
  // autoRotate：az 断言（等 4s）
  {
    const az0 = (await snap()).az;
    const c = await rectExpr(rowSw(7)); await clickAt(c.cx, c.cy); await sleep(4500);
    const az1 = (await snap()).az;
    const c2 = await rectExpr(rowSw(7)); await clickAt(c2.cx, c2.cy); await sleep(300);
    console.log('AUTOROTATE az:', az0, '->', az1, 'changed:', az0 !== az1);
    await shot('sw2_25_after_autorotate');
  }
  // 复位截图（与 baseline 对比，确认开关复位后场景恢复）
  await sleep(500);
  const sEnd = await snap();
  console.log('final store toggles:', JSON.stringify(sEnd.toggles));
  console.log('final scene state:', JSON.stringify(sEnd.scene));
  await shot('sw2_99_final');

  console.log('SWITCH RESULTS:', JSON.stringify(results));
  console.log('LABEL RESULTS:', JSON.stringify(labelChecks));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
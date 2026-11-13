// CDP 验证脚本：真实鼠标点击 DISPLAY CONTROL 8 个开关 + 效果断言
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
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  const shot = async (name, clip) => {
    const params = { format: 'png' };
    if (clip) params.clip = { ...clip, scale: 2 };
    const { result: { data } } = await S('Page.captureScreenshot', params);
    await writeFile(OUT + '\\' + name + '.png', Buffer.from(data, 'base64'));
    console.log('shot', name);
  };
  const metrics = async (w, h, mobile) => { await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); };
  const clickAt = async (x, y) => {
    await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  const rect = async (selector, idx = 0) => evl('(() => { const e = document.querySelectorAll(' + JSON.stringify(selector) + ')[' + idx + ']; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, visible: r.width > 0 && r.height > 0 }; })()');
  const toggles = async () => (await evl('window.__TC__.snapshot()')).toggles;

  await S('Page.enable'); await S('Runtime.enable');
  await metrics(1366, 900, false);
  await S('Page.navigate', { url: URL });
  let boot = false;
  for (let i = 0; i < 60; i++) { await sleep(500); boot = await evl('!!window.__TC__'); if (boot) break; }
  console.log('booted:', boot);
  if (!boot) { console.log('errors:', JSON.stringify(errors)); process.exit(1); }
  await sleep(2000);

  // 滚动到 DISPLAY CONTROL 区域
  await evl("document.getElementById('display-switches').scrollIntoView({ block: 'center' })");
  await sleep(400);
  const rows = await evl("JSON.stringify(Array.from(document.querySelectorAll('.switch-row')).map((r, i) => ({ i, text: r.querySelector('label') ? r.querySelector('label').textContent : '', checked: r.querySelector('input') ? r.querySelector('input').checked : null, id: r.querySelector('input') ? r.querySelector('input').id : null })))");
  console.log('ROWS:', rows);

  const panel = await rect('#left-panel');
  console.log('left-panel rect:', JSON.stringify(panel));
  const swBox = await rect('#display-switches');
  console.log('switches rect:', JSON.stringify(swBox));

  console.log('toggles initial:', JSON.stringify(await toggles()));
  await shot('sw_00_panel_initial');

  // ---------- 1) 每个开关：真实点击 -> 状态翻转 -> 再次点击复位 ----------
  const results = [];
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    const before = await toggles();
    const c = await rect('.switch-row .sw', i);
    if (!c) { results.push({ i, key, ok: false, err: 'no rect' }); continue; }
    await clickAt(c.cx, c.cy);
    await sleep(350);
    const mid = await toggles();
    const flipped = mid[key] === !before[key];
    await clickAt(c.cx, c.cy);
    await sleep(300);
    const back = await toggles();
    const reverted = back[key] === before[key];
    results.push({ i, key, ok: flipped && reverted, before: before[key], after: mid[key], reverted });
    console.log('switch', i, key, JSON.stringify(results[results.length - 1]));
  }

  // ---------- 2) 点击文字标签也能切换（气流演示 = row 4）----------
  {
    const c = await rect('.switch-row label', 4);
    const before = await toggles();
    await clickAt(c.cx, c.cy);
    await sleep(400);
    const mid = await toggles();
    await clickAt(c.cx, c.cy);
    await sleep(300);
    console.log('LABEL_CLICK airflow:', before.airflow, '->', mid.airflow);
    await shot('sw_01_after_label_clicks');
  }

  // 逐项截图辅助
  const clickRow = async (i) => { const c = await rect('.switch-row .sw', i); await clickAt(c.cx, c.cy); await sleep(400); };

  // ---------- 3) 部件标注 off ----------
  {
    await clickRow(0);
    const disp = await evl("(() => { const l = document.querySelector('#label-layer .tc-label-layer'); return l ? getComputedStyle(l).display : 'missing'; })()");
    console.log('labels-layer display after OFF:', disp);
    await shot('sw_10_labels_off');
    await clickRow(0);
    await shot('sw_11_labels_on');
  }

  // ---------- 4) 辉光 off ----------
  {
    await clickRow(2);
    await shot('sw_12_glow_off');
    await clickRow(2);
  }

  // ---------- 5) 环境粒子 off ----------
  {
    await clickRow(3);
    await shot('sw_13_dust_off');
    await clickRow(3);
  }

  // ---------- 6) 气流 on ----------
  {
    await clickRow(4);
    await shot('sw_14_airflow_on');
    await sleep(500);
    await clickRow(4);
  }

  // ---------- 7) 实时阴影 off ----------
  {
    await clickRow(6);
    await shot('sw_15_shadows_off');
    await clickRow(6);
  }

  // ---------- 8) 整机剖切 on（并验证 ghost/slider）----------
  {
    await clickRow(1);
    const t = await toggles();
    const sliderVisible = await evl("!document.getElementById('clip-slider-box').classList.contains('hidden')");
    console.log('clip toggled:', JSON.stringify(t), 'slider box visible:', sliderVisible);
    await shot('sw_16_clip_on');
    await evl("(function(){ const s = document.getElementById('clip-slider'); s.value = '0.3'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await sleep(400);
    const off = await evl('window.__TC__.snapshot().clipOffset');
    console.log('clipOffset after slider input:', off);
    await shot('sw_17_clip_slider_0_3');
    await clickRow(1);
    await sleep(300);
  }

  // ---------- 9) 聚焦淡化（先选中 12 号）----------
  {
    await evl('window.__TC__.selectPart(12)');
    await sleep(600);
    await clickRow(5);
    const t = await toggles();
    console.log('focusFade on:', JSON.stringify(t));
    await shot('sw_18_focusfade_on');
    await clickRow(5);
    await evl('window.__TC__.selectPart(null)');
    await sleep(300);
  }

  // ---------- 10) 自动旋转 ----------
  {
    const az0 = await evl("document.getElementById('hud-az') ? document.getElementById('hud-az').textContent : 'NA'");
    await clickRow(7);
    await sleep(1600);
    const az1 = await evl("document.getElementById('hud-az') ? document.getElementById('hud-az').textContent : 'NA'");
    console.log('autoRotate az:', az0, '->', az1, 'changed:', az0 !== az1);
    await shot('sw_19_autrotate');
    await clickRow(7);
  }

  console.log('SWITCH RESULTS:', JSON.stringify(results));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await send('Target.closeTarget', { targetId });
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
# TURBOCORE · 涡扇发动机 3D 爆炸分解演示

> **TC-X135** 大涵道比双转子民用涡扇发动机的数字孪生交互演示模型。
> 全程序化建模（零外部素材）、24 部件独立可选中 / 显隐 / 隔离、
> A→F 六组顺序爆炸、真实平面剖切 + 机匣 ghost 半透、四段气流可视化、
> 375 / 768 / 1920 三档响应式。

## 快速开始

\`\`\`bash
npm install          # 依赖：three 0.187 / vite 5.4 / vitest 2.1 / typescript 5.6
npm run dev          # 开发服务器 http://localhost:5173
npm run build        # tsc --noEmit && vite build → dist/
npm run preview      # 预览构建产物
npm test             # vitest run（45 项测试）
\`\`\`\`

## 目录结构

\`\`\`
turbocore-engine/
├── index.html                  # 入口页
├── src/
│   ├── main.ts                 # 装配、事件、键盘快捷键、主循环
│   ├── data/parts.ts           # 24 部件 / 6 分组 / 规格 / 五段刻度（单一数据源）
│   ├── state/
│   │   ├── reducer.ts          # 纯状态机（播放/爆炸/剖切/选中/隔离/隐藏）
│   │   └── store.ts            # 发布-订阅 Store
│   ├── three/
│   │   ├── EngineScene.ts      # 场景、剖切面、渲染、HUD 统计
│   │   ├── PartFactory.ts      # 程序化几何 + InstancedMesh + 同材质合并
│   │   ├── solids.ts           # 旋转体/环/叶盘等参数化实体
│   │   ├── explode.ts          # A→F 级联爆炸位姿插值
│   │   ├── airflow.ts          # 四段气流粒子 + 箭头
│   │   ├── materials.ts        # PBR 材质（solid / ghost）
│   │   ├── picking.ts          # Raycaster 拾取
│   │   ├── labels.ts           # CSS2D 部件标签（移动端自动裁剪）
│   │   └── previewScene.ts     # 选中部件迷你预览
│   ├── ui/                     # 顶栏/左树/右检视/底栏/开关/toast
│   └── styles/                 # tokens.css + ui.css
├── tests/                      # 45 项单元测试（reducer/store/explode/collision）
├── tests/screenshots/          # CDP 实测证据截图（11 张）
└── tools/cdp-shots.mjs         # 无头浏览器证据采集套件
\`\`\`

## 24 部件清单

分组与爆炸级联时间窗（A→B→C→D→E→F 顺序）：

| 组 | 名称 | 时间窗 | 部件 |
|----|------|--------|------|
| A | 进气与风扇 INTAKE & FAN | 0.00–0.22 | 01–06 |
| B | 压气机 COMPRESSOR | 0.18–0.42 | 07–11 |
| C | 燃烧 COMBUSTOR | 0.38–0.58 | 12–14 |
| D | 涡轮 TURBINE | 0.54–0.78 | 15–18 |
| E | 轴系与支撑 SHAFT & SUPPORT | 0.74–0.88 | 19–21 |
| F | 排气与外部 EXHAUST & EXTERNAL | 0.84–1.00 | 22–24 |

| # | 中文 | English | 组 | 剖切 ghost |
|---|------|---------|----|-----------|
| 01 | 进气道 | Air Inlet | A | |
| 02 | 风扇整流罩与外部机匣 | Fan Casing | A | ✔ |
| 03 | 风扇叶片（22 片实例） | Fan Blades | A | |
| 04 | 风扇轮毂与进气锥 | Fan Hub & Spinner | A | |
| 05 | 风扇转子盘 | Fan Rotor Disk | A | |
| 06 | 风扇承力框架（12 支板实例） | Fan Frame | A | |
| 07 | 低压压气机转子（3 级） | LPC Rotor | B | |
| 08 | 低压压气机静子（212 静叶） | LPC Stator | B | |
| 09 | 高压压气机转子（8 级） | HPC Rotor | B | |
| 10 | 高压压气机静子（468 静叶） | HPC Stator | B | |
| 11 | 核心机机匣 | Core Casing | B | ✔ |
| 12 | 燃烧室外壳 | Combustor Casing | C | ✔ |
| 13 | 火焰筒 | Combustion Liner | C | |
| 14 | 燃油喷嘴环（20 喷嘴） | Fuel Nozzles | C | |
| 15 | 高压涡轮导向叶片（32 片） | HPT Nozzle | D | |
| 16 | 高压涡轮转子 | HPT Rotor | D | |
| 17 | 低压涡轮导向叶片（46 片） | LPT Nozzle | D | |
| 18 | 低压涡轮转子（3 级） | LPT Rotor | D | |
| 19 | 低压长轴 | LP Shaft | E | |
| 20 | 高压轴 | HP Shaft | E | |
| 21 | 轴承与支撑框架 | Bearings & Support | E | |
| 22 | 尾喷管 | Exhaust Nozzle | F | |
| 23 | 附件齿轮箱 | Accessory Gearbox | F | |
| 24 | 外涵道壳体/反推格栅 | Bypass Duct & Thrust Reverser | F | ✔ |

整机规格（右面板）：最大推力 135 kN · 涵道比 9.2 · 总压比 42 · 风扇直径 2.05 m · 长度 4.20 m · 干重 2,410 kg。

## 操作与快捷键

**鼠标 / 触控**：左键拖动旋转 · 滚轮缩放 · 右键平移；点击部件选中（高亮 + 迷你预览 + 右面板参数），点击空白取消；触屏单指旋转、双指缩放平移。

**底部进度条**：拖动或点击跳转，五段刻度（进气/风扇 → 压气机 → 燃烧室 → 涡轮 → 排气/轴系），与播放共用同一进度真值、双向同步。

| 键 | 功能 | 键 | 功能 |
|----|------|----|------|
| Space | 播放 / 暂停 | F | 聚焦选中部件 |
| R | 重装配（回 0%） | I | 隔离选中（再按取消） |
| V | 重置视角 | H | 隐藏 / 显示选中 |
| S | 剖切开关 | Esc | 取消选中 |
| 1 / 2 / 3 | 装配 / 爆炸 / 剖切模式 | | |

**DISPLAY CONTROL 开关面板（8 项）**：部件标注 / 整机剖切 / 辉光效果 / 环境粒子 / 气流演示 / 聚焦淡化 / 实时阴影 / 自动旋转；下方「剖切平面 Y」滑块常驻显示（未开剖切时置灰禁用，避免面板高度跳动）。开关同时驱动 store 与真实场景状态，操作均有 toast 反馈。

## 浏览器兼容

需要 **WebGL2**：Chrome/Edge 122+、Firefox 124+、Safari 17+、Android Chrome/移动 Safari 现代版本。无 WebGL2 时页面给出提示。桌面与移动端（375/768 宽）均无横向溢出，≤768px 时部件标签自动裁剪至 8 个。

## 验收清单（DoD 逐条实测）

| # | 要求 | 实测结果 | 证据 |
|---|------|----------|------|
| 1 | 24 部件独立 Object3D，可选中/显隐/隔离，程序化建模 | ✔ 24 件均独立节点；点选高亮 + 迷你预览、隔离、隐藏全部可用 | 左树 24/24：tests/screenshots/tc_01_assembly.png；选中 tc_04_selected_preview.png；隔离 tc_05_isolated.png |
| 2 | A→F 顺序爆炸，p=1 无碰撞且在取景内 | ✔ 级联窗口按组推进；碰撞测试 24 件两两无穿插，目标位姿 |x|,|z|≤3.6 m、y∈[-3.1,4.6] | tests/collision.test.ts（3 项）、tests/explode.test.ts（13 项）；tc_02_exploded.png、tc_09_progress25.png、tc_10_progress75.png |
| 3 | 播放/暂停/继续/反向/重装配，单一 progress 真值，25/50/75% 无跳动 | ✔ 纯状态机 reducer 单一 progress；各状态 22+7 项单测覆盖 | tests/reducer.test.ts（22 项）、tests/store.test.ts（7 项） |
| 4 | 滑块与播放共用状态、双向同步、五段刻度 | ✔ 拖动挂起播放、松手恢复；刻度 5 段 + 百分比 | tests/store.test.ts grabSlider/releaseSlider；tc_01（0%） |
| 5 | 真实平面剖切 + 机匣 ghost，可与分解/选中叠加 | ✔ 渲染级裁剪平面；机匣（02/11/12/24）半透可叠加 | tc_03_section.png（内部截面可见、外涵道半透、「03 剖切」高亮） |
| 6 | 四段气流（蓝/青/橙/红橙）粒子 + 箭头可开关 | ✔ 四段色带 #4DA8FF/#2FE7D5/#FF8A2B/#FF4A26，粒子 + 箭头实例化渲染，开关独立 | tc_11_airflow.png（蓝/橙粒子流可见）；帧数据 78,416 tris / 109 calls |
| 7 | 四区无死按钮；标签/环台网格/灯光/HUD/toast | ✔ 顶栏/左树/右检视/底栏全交互；HUD 显示方位角/俯仰角/FPS/三角面/DRAW CALL；隐藏部件后无残留标签（hiddenLabels []） | tc_08_help_modal.png；CDP 运行日志 |
| 8 | 375/768/1920 三档适配 + 触摸手势 | ✔ 三档实测无横向溢出（scrollW=clientW）；≤768px 标签裁剪 8/24 | tc_06_mobile375.png、tc_07_mobile768.png（CDP 实测 overflowX:false） |
| 9 | 性能达标（HUD） | ✔ tris ≤ 80,688（预算 800K）、draw calls 95–116（预算 ≤120） | CDP 各态快照；见「性能实测」 |
| 10 | build + vitest 真实通过 + 截图证据 | ✔ tsc + vite build 通过；vitest 45/45；11 张 CDP 截图 | tests/screenshots/ 全套；运行日志 exit 0 |
| 11 | README 齐全（简介/命令/目录/清单/快捷键/兼容/验收/限制） | ✔ 即本文档 | — |

**手动验收映射**：滑块 25/75% 确定性停位（tc_09/tc_10 与滑块刻度一致）· 播放暂停继续（reducer 状态机单测）· 反向与重装配回 0（reducer/store 单测）· 播放中拖滑块（store 单测）· 剖切 0/50/100% 三态（tc_01 关 0% / tc_03 开 50% / tc_02 爆炸 100%）· 24 件逐一点选（树 24/24 + tc_04 选中联动）· 手势/开关（开关面板逐项帧数据验证；触摸手势基于 OrbitControls 标准实现，见已知限制）· 三档视口（375/768/1366 CDP 实测）。

## 性能实测

无头 Edge + SwiftShader 软件渲染（1366×900），最终构建 dist/assets/index-DSSDPWzl.js：

| 状态 | 三角面 | 绘制调用 | FPS |
|------|--------|----------|-----|
| 装配 0% | 78,416 | 109 | 24 |
| 爆炸 100% | 78,416 | 109 | 25 |
| 剖切 50% | 80,688 | 116 | 22 |
| 纯场景（辉光关） | 78,402 | 95 | 28 |
| 气流开启 | 78,416 | 109 | 25 |

控制台错误：**0**。预算（calls ≤ 120、tris ≤ 800K）全部达标。

## 已知限制（如实说明）

1. **fps 数值为软件渲染上限**：证据环境是无 GPU 的无头 Edge（SwiftShader），22–29 FPS 是 CPU 软渲染瓶颈；在真实 GPU 浏览器上预期显著更高。
2. **反推格栅未单独建模**：24 号部件数据标注 48 片反推格栅，几何上仅建模外环筒体。
3. **触摸手势未真机验证**：375/768 布局与标签裁剪已实测；捏合/旋转依赖 OrbitControls 标准触摸实现，建议真机复核。
4. **剖切为渲染裁剪平面**（clipping plane 视觉剖切），非实体布尔剖切。
5. **气流为示意粒子流**，速度/颜色按轴向四段示意，非 CFD 仿真结果。

## v1.1 修复：显示开关真正可点（2026-11-14）

**问题**：左下 DISPLAY CONTROL 的 8 个开关点击无反应、无效果。

**两个根因**：

1. **交互层**：`src/styles/ui.css` 里 `.sw input { display: none; }` 把真实 checkbox 隐藏了，而文字 `<label>` 没有 `for`、`.sw` 也没有 `htmlFor`，也没有 click 处理器 —— 点开关和点文字都到不了 checkbox，`change` 永远不触发。修复：input 给 `id="sw-<key>"`，文字 label 与 `.sw` 都改 `<label htmlFor>`，input 改为 `.sw` 内绝对定位全尺寸透明覆盖层（原生点击即切换）。
2. **状态层**：`AirflowLayer` 构造时默认可见，而 store 初始值是 `airflow:false`，启动时没有把 store 初始值同步到场景 —— 第一次点「气流演示」只改了 store、画面没变化。修复：`main.ts` 创建场景后立即用 store 初始值调用 `setLabels/setClip/setGlow/setDust/setAirflow/setShadows/setAutoRotate`。

另外修复：剖切开启时 `#clip-slider-box` 从 `display:none` 变可见会让整个开关网格上移约 55px（面板跳动、易误点）。现在滑块行常驻（`.off` 置灰禁用），面板高度恒定。

**验证证据**（`tools/cdp-switches3.mjs`，无头 Edge 真实 `Input.dispatchMouseEvent` 点击）：

| 开关 | store 翻转/复位 | 场景状态翻转/复位 | 面板位移 |
|------|----------------|------------------|---------|
| 部件标注 / 整机剖切 / 辉光效果 / 环境粒子 / 气流演示 / 聚焦淡化 / 实时阴影 / 自动旋转 | 8/8 ✔ | 7/7 ✔（聚焦淡化无场景开关，走 deriveOpacity） | 0 px |

- 初始 store 与场景状态 8/8 一致（修复前 airflow 不一致）；文字标签点击同样生效；剖切滑块拖动后 `scene.clipOffset` 真值同步 0.15→0.35；自动旋转方位角 44.5°→43.9° 实测在转；控制台错误 0。
- 像素级效果对比（1366×900，阈值 12）：辉光开/关 17.6% 像素不同、剖切 25.4%、部件标注 5.9%、聚焦淡化 3.9%、阴影 1.0%、环境粒子 0.1%、气流 0.24%（拆到 100% 分解态，粒子为小粒径加色混合点，视觉确认蓝/青/橙/红四段气流可见）。
- 移动端 390×844：`scrollWidth == innerWidth == 390`，无横向溢出。

## 离线单文件版与桌面快捷方式

```bash
node tools/build-standalone.mjs
```

把 `dist/` 的 JS/CSS 内联成单文件 `dist/turbocore-standalone.html`，并复制到 `E:\Apps\turbocore\TURBOCORE.html`（约 664 KB）。该文件可**直接双击用浏览器打开，不需要本地服务器**（内联 `<script type="module">` + `file://` 实测可正常启动、WebGL 渲染、无 console 错误）。

桌面快捷方式：`C:\Users\<用户>\Desktop\TURBOCORE 涡扇3D爆炸分解.lnk` → 目标 `msedge.exe --app="file:///E:/Apps/turbocore/TURBOCORE.html" --window-size=1440,900`，图标 `E:\Apps\turbocore\turbocore.ico`（由装配态渲染图裁切生成）。以 Edge 应用窗口模式打开，无地址栏/标签页，像独立桌面应用；实测窗口标题「TURBOCORE · 涡扇发动机 3D 爆炸分解演示」且画面完整渲染。

> 单文件版与 `npm run dev` / `vite preview` 加载的是同一份构建；行为一致，只是省掉了静态服务器。

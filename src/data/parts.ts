// ============================================================================
// 24 部件清单与静态参数（单一数据源）
// 视图、左侧树、右侧检视、爆炸位移全部读这一份数据。
// 坐标系约定：发动机沿 +Y 轴（前端=+Y，排气端=-Y）。
// ============================================================================

export type GroupId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type ZoneId = 'inlet' | 'compressor' | 'combustor' | 'exhaust' | 'neutral';

export interface PartMetric { k: string; v: string; }

export interface PartDef {
  id: number;
  zh: string;
  en: string;
  groupId: GroupId;
  zone: ZoneId;
  geometryDesc: string;
  funcDesc: string;
  structDesc: string;
  metrics: PartMetric[];
  /** 爆炸目标位姿偏移（相对装配位姿），单位 m */
  explodeOffset: [number, number, number];
  /** 爆炸目标姿态（欧拉角），缺省为不旋转 */
  explodeEuler?: [number, number, number];
  /** CSS2D 悬浮标签是否可见（全部默认可见，移动端按优先级截取） */
  labelVisible: boolean;
  /** 剖切时机匣类 ghost 半透 */
  ghost: boolean;
}

export interface GroupDef {
  id: GroupId;
  zh: string;
  en: string;
  zone: ZoneId;
  /** 级联时间窗 [start, end]，允许小幅重叠 */
  window: [number, number];
}

export const ZONE_COLORS: Record<ZoneId, string> = {
  inlet: '#4DA8FF',
  compressor: '#2FE7D5',
  combustor: '#FF8A2B',
  exhaust: '#FF4A26',
  neutral: '#C7CFD8',
};

export const CORE_FLAME = '#FF5A1F';

export const ENGINE_MODEL = 'TC-X135';
export const ENGINE_BLURB =
  '大涵道比双转子民用涡扇发动机 · 数字孪生 3D 爆炸分解演示模型';

/** 右面板总览六张参数卡 */
export const ENGINE_SPECS: { k: string; v: string; unit: string }[] = [
  { k: '最大推力', v: '135', unit: 'kN' },
  { k: '涵道比', v: '9.2', unit: ':1' },
  { k: '总压比', v: '42', unit: ':1' },
  { k: '风扇直径', v: '2.05', unit: 'm' },
  { k: '长度', v: '4.20', unit: 'm' },
  { k: '干重', v: '2,410', unit: 'kg' },
];

export const GROUPS: GroupDef[] = [
  { id: 'A', zh: '进气与风扇', en: 'INTAKE & FAN', zone: 'inlet', window: [0.0, 0.22] },
  { id: 'B', zh: '压气机', en: 'COMPRESSOR', zone: 'compressor', window: [0.18, 0.42] },
  { id: 'C', zh: '燃烧', en: 'COMBUSTOR', zone: 'combustor', window: [0.38, 0.58] },
  { id: 'D', zh: '涡轮', en: 'TURBINE', zone: 'exhaust', window: [0.54, 0.78] },
  { id: 'E', zh: '轴系与支撑', en: 'SHAFT & SUPPORT', zone: 'neutral', window: [0.74, 0.88] },
  { id: 'F', zh: '排气与外部', en: 'EXHAUST & EXTERNAL', zone: 'exhaust', window: [0.84, 1.0] },
];

/** 底部进度条五段刻度（E 轴系并入第 5 段、F 排气收尾） */
export const SEGMENTS: { label: string; t: number; groups: GroupId[] }[] = [
  { label: '01 进气/风扇', t: 0.11, groups: ['A'] },
  { label: '02 压气机', t: 0.30, groups: ['B'] },
  { label: '03 燃烧室', t: 0.48, groups: ['C'] },
  { label: '04 涡轮', t: 0.66, groups: ['D'] },
  { label: '05 排气/轴系', t: 0.87, groups: ['E', 'F'] },
];

export const PARTS: PartDef[] = [
  {
    id: 1, zh: '进气道', en: 'Air Inlet', groupId: 'A', zone: 'inlet',
    geometryDesc: '截锥圆筒 + 唇口圆环，金属 PBR',
    funcDesc: '整流进入发动机的空气，保证风扇进口流场均匀。',
    structDesc: '薄壁钛合金唇口与短舱前段，前缘防冰通道内置。',
    metrics: [
      { k: '唇口直径', v: '2.04 m' },
      { k: '进气流量', v: '1,180 kg/s' },
      { k: '壁厚', v: '8 mm' },
    ],
    explodeOffset: [0, 1.3, 0], labelVisible: true, ghost: false,
  },
  {
    id: 2, zh: '风扇整流罩与外部机匣', en: 'Fan Casing', groupId: 'A', zone: 'inlet',
    geometryDesc: '大直径薄壁圆筒，可剖切半透',
    funcDesc: '构成外涵流道外壁并包容风扇叶片。',
    structDesc: '大直径薄壁筒体，内壁带声学处理面板。',
    metrics: [
      { k: '外径', v: '2.05 m' },
      { k: '机匣壁厚', v: '12 mm' },
      { k: '材料', v: '钛合金' },
    ],
    explodeOffset: [0, 0.45, -2.1], labelVisible: true, ghost: true,
  },
  {
    id: 3, zh: '风扇叶片', en: 'Fan Blades', groupId: 'A', zone: 'inlet',
    geometryDesc: '22 片 InstancedMesh 扭转叶型',
    funcDesc: '驱动约 80% 空气进入外涵道，产生主要推力。',
    structDesc: '22 片宽弦钛合金叶型，三维扭转设计，叶尖线速度 460 m/s。',
    metrics: [
      { k: '叶片数', v: '22' },
      { k: '叶尖线速度', v: '460 m/s' },
      { k: '材料', v: '宽弦钛合金' },
    ],
    explodeOffset: [0, 0.55, 0], labelVisible: true, ghost: false,
  },
  {
    id: 4, zh: '风扇轮毂与进气锥', en: 'Fan Hub & Spinner', groupId: 'A', zone: 'inlet',
    geometryDesc: '旋转体（Lathe）整流锥',
    funcDesc: '整流风扇进口并防止进气锥结冰。',
    structDesc: '旋转体整流锥 + 轮毂，内装电热防冰系统。',
    metrics: [
      { k: '锥体长度', v: '0.72 m' },
      { k: '轮毂直径', v: '0.70 m' },
      { k: '防冰', v: '电热' },
    ],
    explodeOffset: [0, 1.95, 0], labelVisible: true, ghost: false,
  },
  {
    id: 5, zh: '风扇转子盘', en: 'Fan Rotor Disk', groupId: 'A', zone: 'inlet',
    geometryDesc: '圆盘 + 轮缘',
    funcDesc: '承载风扇叶片并传递扭矩。',
    structDesc: '钛合金整体叶盘轮缘，双辐板轻量化设计。',
    metrics: [
      { k: '盘直径', v: '0.85 m' },
      { k: '转速', v: '3,850 rpm' },
      { k: '材料', v: 'Ti-6Al-4V' },
    ],
    explodeOffset: [1.732, 0.35, 1.0], labelVisible: true, ghost: false,
  },
  {
    id: 6, zh: '风扇承力框架', en: 'Fan Frame', groupId: 'A', zone: 'inlet',
    geometryDesc: '环形框 + 12 根径向支板（实例化）',
    funcDesc: '支撑风扇转子并传递轴向载荷。',
    structDesc: '环形框架 + 12 根径向支板，钛合金锻件。',
    metrics: [
      { k: '径向支板', v: '12' },
      { k: '外径', v: '2.02 m' },
      { k: '材料', v: '钛锻件' },
    ],
    explodeOffset: [-1.732, 0.15, 1.0], labelVisible: true, ghost: false,
  },
  {
    id: 7, zh: '低压压气机转子', en: 'LPC Rotor', groupId: 'B', zone: 'compressor',
    geometryDesc: '3 级叶盘串接，级数由数据配置',
    funcDesc: '低压段增压，提高核心机进口压力。',
    structDesc: '3 级钛合金叶盘串接，直径逐级缩小。',
    metrics: [
      { k: '级数', v: '3' },
      { k: '压比', v: '1.9:1' },
      { k: '转速', v: '5,200 rpm' },
    ],
    explodeOffset: [0, 1.95, 0], labelVisible: true, ghost: false,
  },
  {
    id: 8, zh: '低压压气机静子', en: 'LPC Stator', groupId: 'B', zone: 'compressor',
    geometryDesc: '机匣内环 + 4 排静叶实例阵列',
    funcDesc: '整流增压气流，提高压气机效率。',
    structDesc: '机匣内环 + 4 排钛合金静叶。',
    metrics: [
      { k: '级数', v: '4' },
      { k: '静叶数', v: '212' },
      { k: '材料', v: '钛合金' },
    ],
    explodeOffset: [1.732, 0.15, 1.0], labelVisible: true, ghost: false,
  },
  {
    id: 9, zh: '高压压气机转子', en: 'HPC Rotor', groupId: 'B', zone: 'compressor',
    geometryDesc: '8 级叶盘，直径逐级缩小',
    funcDesc: '核心段高压比增压，压缩到 1.42 MPa。',
    structDesc: '8 级叶盘串接，出口温度 612 ℃。',
    metrics: [
      { k: '级数', v: '8' },
      { k: '压比', v: '11.8:1' },
      { k: '出口压力', v: '1.42 MPa' },
      { k: '出口温度', v: '612 ℃' },
    ],
    explodeOffset: [0, -0.1, 0], labelVisible: true, ghost: false,
  },
  {
    id: 10, zh: '高压压气机静子', en: 'HPC Stator', groupId: 'B', zone: 'compressor',
    geometryDesc: '8 排静叶环实例',
    funcDesc: '高压段整流，减少流动损失。',
    structDesc: '8 排镍基合金静叶环。',
    metrics: [
      { k: '级数', v: '8' },
      { k: '静叶数', v: '468' },
      { k: '材料', v: '镍基合金' },
    ],
    explodeOffset: [1.732, -0.15, -1.0], labelVisible: true, ghost: false,
  },
  {
    id: 11, zh: '核心机机匣', en: 'Core Casing', groupId: 'B', zone: 'compressor',
    geometryDesc: '薄壁锥筒，剖切时 ghost 半透',
    funcDesc: '包容核心机并构成内流道。',
    structDesc: '锥形薄壁筒体，Inconel 718 锻造。',
    metrics: [
      { k: '外径', v: '1.28 m' },
      { k: '壁厚', v: '12 mm' },
      { k: '材料', v: 'Inconel 718' },
    ],
    explodeOffset: [0, 0.55, 2.0], labelVisible: true, ghost: true,
  },
  {
    id: 12, zh: '燃烧室外壳', en: 'Combustor Casing', groupId: 'C', zone: 'combustor',
    geometryDesc: '环形外壳',
    funcDesc: '承受燃烧室压力并构成外壁。',
    structDesc: '环形壳体，Hastelloy X 耐热合金。',
    metrics: [
      { k: '外径', v: '1.12 m' },
      { k: '长度', v: '0.46 m' },
      { k: '材料', v: 'Hastelloy X' },
    ],
    explodeOffset: [-1.732, 0.05, -1.0], labelVisible: true, ghost: true,
  },
  {
    id: 13, zh: '火焰筒', en: 'Combustion Liner', groupId: 'C', zone: 'combustor',
    geometryDesc: '内外环 + 头部涡流器，主燃孔/掺混孔用实例小孔表达',
    funcDesc: '组织燃烧，稳定火焰并均匀出口温度场。',
    structDesc: '内外环火焰筒 + 头部涡流器，环形燃烧室结构。',
    metrics: [
      { k: '出口温度', v: '1,380 ℃' },
      { k: '主燃孔', v: '40' },
      { k: '掺混孔', v: '80' },
      { k: 'OTDF', v: '0.18' },
    ],
    explodeOffset: [0, 0.35, 2.0], labelVisible: true, ghost: false,
  },
  {
    id: 14, zh: '燃油喷嘴环', en: 'Fuel Nozzles', groupId: 'C', zone: 'combustor',
    geometryDesc: '环形管 + 一圈喷嘴实例',
    funcDesc: '雾化燃油并与空气掺混燃烧。',
    structDesc: '环形供油管 + 20 个空气雾化喷嘴。',
    metrics: [
      { k: '喷嘴数', v: '20' },
      { k: '燃油流量', v: '2,180 kg/h' },
      { k: '雾化锥角', v: '85°' },
    ],
    explodeOffset: [-1.732, 0.2, 1.0], labelVisible: true, ghost: false,
  },
  {
    id: 15, zh: '高压涡轮导向叶片', en: 'HPT Nozzle', groupId: 'D', zone: 'exhaust',
    geometryDesc: '喷嘴叶栅环',
    funcDesc: '引导高温燃气以最佳角度冲击转子。',
    structDesc: '32 片单晶合金导向叶片。',
    metrics: [
      { k: '叶片数', v: '32' },
      { k: '进口温度', v: '1,450 ℃' },
      { k: '材料', v: '单晶合金' },
    ],
    explodeOffset: [1.732, -0.35, -1.0], labelVisible: true, ghost: false,
  },
  {
    id: 16, zh: '高压涡轮转子', en: 'HPT Rotor', groupId: 'D', zone: 'exhaust',
    geometryDesc: '高温涡轮叶盘，暖色金属',
    funcDesc: '驱动高压压气机做功。',
    structDesc: '单级高温叶盘，单晶叶片 + 粉末盘。',
    metrics: [
      { k: '级数', v: '1' },
      { k: '转速', v: '12,800 rpm' },
      { k: '进口温度', v: '1,450 ℃' },
    ],
    explodeOffset: [0, -0.55, 0], labelVisible: true, ghost: false,
  },
  {
    id: 17, zh: '低压涡轮导向叶片', en: 'LPT Nozzle', groupId: 'D', zone: 'exhaust',
    geometryDesc: '叶栅环',
    funcDesc: '引导燃气进入低压涡轮。',
    structDesc: '46 片导向叶栅环。',
    metrics: [
      { k: '叶片数', v: '46' },
      { k: '进口温度', v: '1,020 ℃' },
    ],
    explodeOffset: [0, -0.6, -2.0], labelVisible: true, ghost: false,
  },
  {
    id: 18, zh: '低压涡轮转子', en: 'LPT Rotor', groupId: 'D', zone: 'exhaust',
    geometryDesc: '3 级涡轮叶盘',
    funcDesc: '驱动风扇与低压压气机。',
    structDesc: '3 级叶盘，粉末冶金高温合金。',
    metrics: [
      { k: '级数', v: '3' },
      { k: '转速', v: '5,200 rpm' },
      { k: '材料', v: '粉末冶金盘' },
    ],
    explodeOffset: [0, -0.7, 2.0], labelVisible: true, ghost: false,
  },
  {
    id: 19, zh: '低压长轴', en: 'LP Shaft', groupId: 'E', zone: 'neutral',
    geometryDesc: '细长圆柱，贯穿整机',
    funcDesc: '连接风扇与低压涡轮传递扭矩。',
    structDesc: '长 3.62 m 细长空心轴，贯穿整机。',
    metrics: [
      { k: '长度', v: '3.62 m' },
      { k: '直径', v: '120 mm' },
      { k: '转速', v: '5,200 rpm' },
    ],
    explodeOffset: [0, 0.05, 0], labelVisible: true, ghost: false,
  },
  {
    id: 20, zh: '高压轴', en: 'HP Shaft', groupId: 'E', zone: 'neutral',
    geometryDesc: '同心套轴，不同金属灰度区分',
    funcDesc: '连接高压涡轮与高压压气机。',
    structDesc: '同心套轴，套在低压轴外侧。',
    metrics: [
      { k: '长度', v: '1.55 m' },
      { k: '直径', v: '200 mm' },
      { k: '转速', v: '12,800 rpm' },
    ],
    explodeOffset: [0, 0.35, 0], labelVisible: true, ghost: false,
  },
  {
    id: 21, zh: '轴承与支撑框架', en: 'Bearings & Support', groupId: 'E', zone: 'neutral',
    geometryDesc: '轴承座 + 支板',
    funcDesc: '支承转子，保持同心与轴向定位。',
    structDesc: '5 个支点，滚珠/滚棒轴承组合。',
    metrics: [
      { k: '支点', v: '5' },
      { k: '轴承', v: '滚珠 3 + 滚棒 2' },
      { k: '滑油温度', v: '130 ℃' },
    ],
    explodeOffset: [0, -1.05, 0], labelVisible: true, ghost: false,
  },
  {
    id: 22, zh: '尾喷管', en: 'Exhaust Nozzle', groupId: 'F', zone: 'exhaust',
    geometryDesc: '收敛喷口 + 中心尾锥',
    funcDesc: '收敛加速燃气产生推力。',
    structDesc: '收敛喷口 + 中心尾锥，排气速度 480 m/s。',
    metrics: [
      { k: '出口直径', v: '0.68 m' },
      { k: '排气速度', v: '480 m/s' },
      { k: '收敛比', v: '0.65' },
    ],
    explodeOffset: [0, -0.45, 0], labelVisible: true, ghost: false,
  },
  {
    id: 23, zh: '附件齿轮箱', en: 'Accessory Gearbox', groupId: 'F', zone: 'neutral',
    geometryDesc: '机匣下方箱体 + 管线',
    funcDesc: '驱动燃油泵、滑油泵等附件。',
    structDesc: '机匣下方箱体 + 附件管线。',
    metrics: [
      { k: '功率', v: '650 kW' },
      { k: '输出轴', v: '4' },
      { k: '速比', v: '1:1.28' },
    ],
    explodeOffset: [-1.732, -1.35, -1.0], labelVisible: true, ghost: false,
  },
  {
    id: 24, zh: '外涵道壳体/反推格栅', en: 'Bypass Duct & Thrust Reverser', groupId: 'F', zone: 'exhaust',
    geometryDesc: '外环筒体 + 格栅细节',
    funcDesc: '构成外涵流道并实现反推。',
    structDesc: '外环筒体 + 48 片反推格栅。',
    metrics: [
      { k: '外径', v: '1.72 m' },
      { k: '外涵面积比', v: '3.4:1' },
      { k: '反推格栅', v: '48' },
    ],
    explodeOffset: [0, -0.85, 0], labelVisible: true, ghost: true,
  },
];

export const partById = (id: number): PartDef => PARTS.find((p) => p.id === id)!;
export const groupById = (id: GroupId): GroupDef => GROUPS.find((g) => g.id === id)!;
export const padId = (id: number): string => String(id).padStart(2, '0');
export const partsOfGroup = (gid: GroupId): PartDef[] => PARTS.filter((p) => p.groupId === gid);

export type TriggerDamagePermission = boolean | "不适用";

export interface TriggerDamageEntry {
  name: string;
  href?: string;
  perkSlug?: string;
  overlimitId?: string;
  trigger: string;
  interval: string;
  numericalId: string;
  damageType: string;
  damageValue: string;
  toughness: number | string;
  element: string;
  critical: TriggerDamagePermission | null;
  weakpoint: TriggerDamagePermission | null;
  weakpointMultiplier?: number | string | null;
  note?: string;
  pending?: string;
}

export type TriggerDamageGroup =
  | "current"
  | "overlimit"
  | "bonds"
  | "offline"
  | "prototype"
  | "unassigned"
  | "historical";

const current = [
  { name: "烈焰冲击", href: "/perks/slot-4/烈焰冲击", perkSlug: "slot-4/烈焰冲击", overlimitId: "20703040033", trigger: "使用主动技能后持续 6 秒", interval: "每 2 秒", numericalId: "11010041", damageType: "技能伤害", damageValue: "187.5", toughness: 0, element: "火焰", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "追身导弹", href: "/perks/slot-4/追身导弹", perkSlug: "slot-4/追身导弹", trigger: "累计命中 10 次后发射 1 枚导弹", interval: "2 秒", numericalId: "11010084", damageType: "技能伤害", damageValue: "250", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "连锁电环", href: "/perks/slot-4/连锁电环", perkSlug: "slot-4/连锁电环", trigger: "一次开火命中至少 2 次或至少 2 个目标", interval: "5 秒", numericalId: "11010085", damageType: "技能伤害", damageValue: "50", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "释能火环", href: "/perks/slot-4/释能火环", perkSlug: "slot-4/释能火环", trigger: "释放技能", interval: "3 秒", numericalId: "11010086", damageType: "技能伤害", damageValue: "170", toughness: 0, element: "火焰", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "霜滞协议", href: "/perks/slot-4/霜滞协议", perkSlug: "slot-4/霜滞协议", trigger: "开火或技能触发多次伤害", interval: "2 秒", numericalId: "11010087", damageType: "技能伤害", damageValue: "50", toughness: 0, element: "寒冷", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "闪电协议", href: "/perks/slot-4/闪电协议", perkSlug: "slot-4/闪电协议", trigger: "单发全部弹丸命中同一敌人", interval: "3 秒", numericalId: "11010088", damageType: "技能伤害", damageValue: "300", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "精确导弹", href: "/perks/slot-4/精确导弹", perkSlug: "slot-4/精确导弹", trigger: "弱点命中累计 3 次后发射 2 枚导弹", interval: "5 秒", numericalId: "11010089", damageType: "技能伤害", damageValue: "180/枚 × 2", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "毒属爆破", href: "/perks/slot-4/毒属爆破", perkSlug: "slot-4/毒属爆破", trigger: "腐蚀武器射击有 3% 概率触发 0.5 米爆炸", interval: "未见独立冷却", numericalId: "11010121", damageType: "技能伤害", damageValue: "290", toughness: 0, element: "腐蚀", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "合圈震荡", href: "/perks/slot-4/合圈震荡", perkSlug: "slot-4/合圈震荡", trigger: "召唤物造成伤害时触发冲击环", interval: "3 秒", numericalId: "11010122", damageType: "技能伤害", damageValue: "90/环", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "余波扩散", href: "/perks/slot-3/余波扩散", perkSlug: "slot-3/余波扩散", trigger: "武器技能命中后在技能中心生成冲击波", interval: "3 秒", numericalId: "11010141", damageType: "技能伤害", damageValue: "200", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "双星回响", href: "/perks/slot-3/双星回响", perkSlug: "slot-3/双星回响", trigger: "双星存在期间连续命中同一目标 5 次", interval: "3 秒", numericalId: "11010131", damageType: "技能伤害", damageValue: "900", toughness: 10, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, pending: "执行资产只有默认属性、没有可读字节码，按同名 Numerical 行收录，引用链待核验" },
  { name: "黑洞吞噬", href: "/perks/slot-3/黑洞吞噬", perkSlug: "slot-3/黑洞吞噬", trigger: "黑洞结束时在中心生成冲击波", interval: "每次黑洞结束", numericalId: "11010132", damageType: "技能伤害", damageValue: "170", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, pending: "执行资产只有默认属性、没有可读字节码，按同名 Numerical 行收录，引用链待核验" },
  { name: "矩阵湮灭", href: "/perks/slot-3/矩阵湮灭", perkSlug: "slot-3/矩阵湮灭", trigger: "矩阵内每个友方单位发出湮灭；矩阵消失时爆炸", interval: "湮灭 5 秒", numericalId: "11010133 / 11010134", damageType: "技能伤害", damageValue: "湮灭 265；爆炸 800 起", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, pending: "执行资产只有默认属性、没有可读字节码，按同名 Numerical 行收录，引用链待核验" },
  { name: "战灵余烬", href: "/perks/slot-3/战灵余烬", perkSlug: "slot-3/战灵余烬", trigger: "召唤物消失时消耗余烬能量释放 10 米冲击", interval: "13 秒", numericalId: "11010135", damageType: "技能伤害", damageValue: "基础 650", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, pending: "执行资产只有默认属性、没有可读字节码，按同名 Numerical 行收录，引用链待核验" },
  { name: "瘟疫之源", href: "/perks/slot-3/瘟疫之源", perkSlug: "slot-3/瘟疫之源", trigger: "击杀减速目标后留下持续 5 秒的区域", interval: "冷却 10 秒；区域每秒结算", numericalId: "11010136", damageType: "技能伤害", damageValue: "100/次", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "毒池名称和特效不改变伤害元素；友方治疗使用另一行 11010137", pending: "S4_PoisonZone 已核到伤害行；MGE 生成该区域的执行链缺少可读字节码" },
  { name: "爆破强化", href: "/perks/slot-3/爆破强化", perkSlug: "slot-3/爆破强化", trigger: "击杀目标后，以该次结算伤害为输入触发二次爆破", interval: "1 秒", numericalId: "11010140", damageType: "间接伤害", damageValue: "原伤害 × 33%", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "读取击杀结算的伤害作为输入，不按基础攻击力 500 折算为固定 165" },
  { name: "疾风残影", href: "/perks/slot-3/疾风残影", perkSlug: "slot-3/疾风残影", trigger: "移动时在身后生成持续 2 秒的小电弧区域", interval: "生成间隔 2 秒；区域接触触发", numericalId: "11010142", damageType: "技能伤害", damageValue: "200/次", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "S4_ElectricArc 的电弧表现实际使用物理伤害配置" },
] satisfies readonly TriggerDamageEntry[];

const overlimit = [
  { name: "致命爆炸", href: "/overlimit/20703040437", perkSlug: "slot-4/致命爆炸", overlimitId: "20703040437", trigger: "武器命中有 5% 概率产生 8 米爆炸", interval: "0.1 秒", numericalId: "130103014", damageType: "技能伤害", damageValue: "5000", toughness: 10, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "导弹轰炸", href: "/overlimit/20703040471", perkSlug: "slot-3/导弹轰炸", overlimitId: "20703040471", trigger: "爆炸命中发 2 枚；仅命中 1 个单位时发 5 枚", interval: "2 秒", numericalId: "121800050", damageType: "技能伤害", damageValue: "2100/枚", toughness: 4.2, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "换弹冲击", href: "/overlimit/20703040472", perkSlug: "slot-3/换弹冲击", overlimitId: "20703040472", trigger: "弹匣耗尽后每秒释放冲击波，持续 5 秒", interval: "1 秒周期", numericalId: "121800060", damageType: "技能伤害", damageValue: "基础 1800/次", toughness: 3.6, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "万伤掷弹", href: "/overlimit/20703040473", perkSlug: "slot-3/万伤掷弹", overlimitId: "20703040473", trigger: "累计造成 10000 点伤害后生成 2 枚榴弹", interval: "0.1 秒", numericalId: "121800070", damageType: "技能伤害", damageValue: "2100/枚 × 2", toughness: 4.2, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "爆毒蚀域", href: "/overlimit/20703040474", perkSlug: "slot-4/爆毒蚀域", overlimitId: "20703040474", trigger: "暴击时投出毒液罐并留下毒池", interval: "20 秒", numericalId: "121500071", damageType: "持续伤害", damageValue: "350/秒", toughness: 0.7, element: "腐蚀", critical: true, weakpoint: false, weakpointMultiplier: 1, pending: "表中只列已核到的毒池配置；投射物自身继承的爆炸是否对敌生效尚缺父类执行证据" },
  { name: "游击飞弹", href: "/overlimit/1317229001", perkSlug: "slot-4/游击飞弹", overlimitId: "1317229001", trigger: "每移动 10 米发射 2 枚跟踪弹", interval: "未见独立冷却", numericalId: "121800050", damageType: "技能伤害", damageValue: "2100/枚 × 2", toughness: 4.2, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "飞弹狂射", href: "/overlimit/1317232001", perkSlug: "slot-4/飞弹狂射", overlimitId: "1317232001", trigger: "累计造成 10 次武器伤害后发射 2 枚", interval: "1 秒", numericalId: "121800052", damageType: "技能伤害", damageValue: "2100/枚 × 2", toughness: 4.2, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "暴击飞弹", href: "/overlimit/1317234001", perkSlug: "slot-4/暴击飞弹", overlimitId: "1317234001", trigger: "每次暴击发射 1 枚跟踪弹", interval: "0.5 秒", numericalId: "121800052", damageType: "技能伤害", damageValue: "2100", toughness: 4.2, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "近战冲击", href: "/overlimit/1317240001", perkSlug: "slot-4/近战冲击", overlimitId: "1317240001", trigger: "近战命中有 50% 概率产生 8 米冲击波", interval: "0.5 秒", numericalId: "121800080", damageType: "技能伤害", damageValue: "1250", toughness: 2.5, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "地龙惊破", href: "/overlimit/20703040202", perkSlug: "slot-4/地龙惊破", overlimitId: "20703040202", trigger: "累计造成 10000 点伤害后连续结算 5 次", interval: "8 秒", numericalId: "11010097", damageType: "技能伤害", damageValue: "300/次 × 5", toughness: 0, element: "火焰", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "换弹引爆", href: "/overlimit/20703040528", overlimitId: "20703040528", trigger: "开火施加灼热标记，换弹时产生 5 米冲击波", interval: "换弹触发", numericalId: "11010143", damageType: "技能伤害", damageValue: "基础 1250", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "本次冲击波技能伤害加成：标记目标每个 +20%，最多计入 5 个；额外卡片层数每层再增加 100% 执行倍率，首张卡不额外加成" },
  { name: "光辉贯穿", href: "/overlimit/20703040478", overlimitId: "20703040478", trigger: "光能叠满 5 层后，下次射击附带贯穿伤害", interval: "满层触发", numericalId: "11010149", damageType: "武器伤害", damageValue: "175", toughness: 0, element: "物理", critical: true, weakpoint: true, weakpointMultiplier: null, note: "通过虚拟枪结算，最多穿透 3 个目标" },
  { name: "死神时刻", href: "/overlimit/1317110001", overlimitId: "1317110001", trigger: "近战重击击杀后释放机械之舞，持续 2 秒", interval: "攻击频率未确认", numericalId: "112044020", damageType: "武器伤害", damageValue: "基础 1200/次", toughness: 2.4, element: "物理", critical: true, weakpoint: true, weakpointMultiplier: null, note: "每 1% 暴击率提供 1% 机械之舞伤害加成；MGE 将技能的 AttackNumericalID 设为 112044020", pending: "已确认技能参数覆写；技能内部调用和攻击频率尚缺执行字节码" },
  { name: "二重高伤", href: "/overlimit/1317129001", overlimitId: "1317129001", trigger: "单次伤害达到目标最大生命值的 10% 后追加结算", interval: "5 秒", numericalId: "112029001", damageType: "自定义伤害", damageValue: "原伤害作为结算输入", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "MGEMakeSettlement 的输入是触发伤害；不能按攻击力 500 写成固定 500 伤害", pending: "自定义结算的最终倍率尚未核到 Native 实现，不宣称必定复制等量最终伤害" },
] satisfies readonly TriggerDamageEntry[];

const offline = [
  { name: "出其不意", href: "/perks/slot-2/出其不意", perkSlug: "slot-2/出其不意", trigger: "扔出的枪体命中敌人", interval: "主动技能充能", numericalId: "1400110101", damageType: "武器技能伤害", damageValue: "250", toughness: 0.05, element: "腐蚀", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "亲密距离", href: "/perks/slot-4/亲密距离", perkSlug: "slot-4/亲密距离", trigger: "单发全部弹片命中同一敌人", interval: "2 秒", numericalId: "11010064", damageType: "技能伤害", damageValue: "450", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "技能扩散", href: "/perks/slot-4/技能扩散", perkSlug: "slot-4/技能扩散", trigger: "主动技能后 15 秒内击杀敌人", interval: "0.3 秒", numericalId: "11010046-50", damageType: "技能伤害", damageValue: "265.15", toughness: 0, element: "随武器元素", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "百万伏特", href: "/perks/slot-4/百万伏特", perkSlug: "slot-4/百万伏特", trigger: "累计造成 100 次伤害，影响 10 米范围", interval: "未见独立冷却", numericalId: "11010045", damageType: "技能伤害", damageValue: "250", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "闪电轰击", href: "/perks/slot-4/闪电轰击", perkSlug: "slot-4/闪电轰击", trigger: "累计命中 5 次", interval: "5 秒", numericalId: "11010063", damageType: "技能伤害", damageValue: "750", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "威慑环爆", href: "/perks/slot-4/威慑环爆", perkSlug: "slot-4/威慑环爆", trigger: "换弹后释放冰环", interval: "未见独立冷却", numericalId: "11010069", damageType: "技能伤害", damageValue: "150", toughness: 0, element: "寒冷", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "弹容爆破", href: "/perks/slot-4/弹容爆破", perkSlug: "slot-4/弹容爆破", trigger: "换弹后释放冰环", interval: "未见独立冷却", numericalId: "11010070", damageType: "技能伤害", damageValue: "基础 125", toughness: 0, element: "寒冷", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "坍缩奇点", href: "/perks/slot-4/坍缩奇点", perkSlug: "slot-4/坍缩奇点", trigger: "击杀带有同属性异常的敌人", interval: "未见独立冷却", numericalId: "11010071-75", damageType: "技能伤害", damageValue: "120-720", toughness: 0, element: "随武器元素", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "追猎齐射", href: "/perks/slot-4/追猎齐射", perkSlug: "slot-4/追猎齐射", trigger: "击破敌人护盾后发射 3 枚飞弹", interval: "按破盾触发", numericalId: "160000014", damageType: "技能伤害", damageValue: "750/枚 × 3", toughness: 0.15, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "闪切霜环", href: "/perks/slot-4/闪切霜环", perkSlug: "slot-4/闪切霜环", trigger: "切换武器", interval: "2 秒", numericalId: "11010091", damageType: "技能伤害", damageValue: "187.5", toughness: 0, element: "寒冷", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "满盾爆破", href: "/perks/slot-4/满盾爆破", perkSlug: "slot-4/满盾爆破", trigger: "满护盾时射击命中，产生 5 米爆炸", interval: "5 秒", numericalId: "11010117", damageType: "技能伤害", damageValue: "135", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "定时震波", href: "/perks/slot-4/定时震波", perkSlug: "slot-4/定时震波", trigger: "召唤物存在时在玩家周围触发", interval: "每 5 秒", numericalId: "11010123", damageType: "技能伤害", damageValue: "190", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "连环震波", href: "/perks/slot-4/连环震波", perkSlug: "slot-4/连环震波", trigger: "钩锁命中首领后连续触发 3 次", interval: "每次间隔 3 秒", numericalId: "11010125", damageType: "技能伤害", damageValue: "500/次 × 3", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "击杀掉货", href: "/perks/slot-4/击杀掉货", perkSlug: "slot-4/击杀掉货", trigger: "拾取任意本赛季能量球", interval: "伤害环 2 秒", numericalId: "11010126", damageType: "技能伤害", damageValue: "100", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "余烬积势", href: "/perks/slot-3/余烬积势", perkSlug: "slot-3/余烬积势", trigger: "获得暗能后释放 10 米冲击环", interval: "随暗能获得触发", numericalId: "11010144", damageType: "技能伤害", damageValue: "2500", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
] satisfies readonly TriggerDamageEntry[];

const prototype = [
  { name: "闪电命中", perkSlug: "slot-3/闪电命中", trigger: "命中 5 次", interval: "旧稿未注明", numericalId: "11010065", damageType: "技能伤害", damageValue: "300", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "闪电轰击早期版本" },
  { name: "超频震爆", perkSlug: "slot-3/超频震爆", trigger: "2 秒内命中 10 次", interval: "旧稿未注明", numericalId: "11010067", damageType: "技能伤害", damageValue: "108", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "文案与执行资产存在版本错位" },
  { name: "十万伏特", perkSlug: "slot-4/十万伏特", trigger: "累计造成 100 次伤害", interval: "旧稿未注明", numericalId: "11010068", damageType: "技能伤害", damageValue: "150", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "百万伏特早期版本" },
  { name: "冰环疾驰", perkSlug: "slot-4/电环疾驰", trigger: "疾跑时周期释放电环", interval: "周期触发", numericalId: "11010104", damageType: "技能伤害", damageValue: "1000", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "名称写冰，Numerical 执行为电弧" },
  { name: "飞弹支援", trigger: "技能期间每命中 3 次发射飞弹", interval: "2 秒", numericalId: "11010084", damageType: "技能伤害", damageValue: "250/枚", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "妙手强化", trigger: "主动技能后击杀触发元素爆炸", interval: "0.3 秒", numericalId: "11010046-50", damageType: "技能伤害", damageValue: "265.15", toughness: 0, element: "随武器元素", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "技能扩散旧稿" },
  { name: "装填强化", trigger: "换弹叠层后每 5 次射击附带爆裂", interval: "不适用", numericalId: "-", damageType: "未形成独立结算", damageValue: "-", toughness: "-", element: "-", critical: "不适用", weakpoint: "不适用", weakpointMultiplier: "-", note: "执行资产当前只实现伤害 Buff" },
  { name: "乘胜追击", perkSlug: "slot-4/乘胜追击", trigger: "10 米外弱点命中 20 次后发射飞弹", interval: "5 秒", numericalId: "11010084", damageType: "技能伤害", damageValue: "250", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "层积裂变", perkSlug: "slot-4/层积裂变", trigger: "同属性异常达到 4 层", interval: "3 秒", numericalId: "11010076-80", damageType: "技能伤害", damageValue: "180", toughness: 0, element: "随异常元素", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "蜂鸣指令", perkSlug: "slot-4/蜂鸣指令", trigger: "射击命中 20 次后发射 2 枚导弹", interval: "2 秒", numericalId: "11010090", damageType: "技能伤害", damageValue: "225/枚 × 2", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "星锤百击", perkSlug: "slot-4/星锤百击", trigger: "命中 100 次后释放飞虫", interval: "旧稿未注明", numericalId: "11010102", damageType: "技能伤害", damageValue: "650", toughness: 0, element: "腐蚀", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "同时可治疗友方" },
  { name: "天官破煞", perkSlug: "slot-4/天官破煞", trigger: "弱点命中 10 次后爆破", interval: "旧稿未注明", numericalId: "11010103", damageType: "技能伤害", damageValue: "225", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "同时施加易伤" },
  { name: "年轮纹波", perkSlug: "slot-4/年轮纹波", trigger: "受到治疗或治疗他人", interval: "旧稿未注明", numericalId: "11010098", damageType: "技能伤害", damageValue: "140", toughness: 0, element: "腐蚀", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "以治疗目标为中心" },
  { name: "超限爆发", perkSlug: "slot-3/超限爆发", trigger: "目标异常层数已满时追加", interval: "每种元素 4 秒", numericalId: "11010105-08", damageType: "技能伤害", damageValue: "230", toughness: 0, element: "对应异常元素", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "环震冲击", perkSlug: "slot-4/环震冲击", trigger: "添加异常时有 30% 概率触发", interval: "3 秒", numericalId: "11010109-12", damageType: "技能伤害", damageValue: "67.5", toughness: 0, element: "对应异常元素", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "持续压制", perkSlug: "slot-4/持续压制", trigger: "进入隐身后每 2 秒释放", interval: "持续 8 秒", numericalId: "11010113", damageType: "技能伤害", damageValue: "100", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "灰烬元爆", perkSlug: "slot-4/灰烬元爆", trigger: "释放炼狱炎臂后下一发命中", interval: "旧稿未注明", numericalId: "11010114", damageType: "技能伤害", damageValue: "1250", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "同时添加四种异常" },
  { name: "技能震荡", perkSlug: "slot-4/技能震荡", trigger: "使用本武器技能后触发", interval: "5 秒", numericalId: "11010116", damageType: "技能伤害", damageValue: "40", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "描述仍残留 XX%，数值取执行 Numerical" },
  { name: "冰火引爆", perkSlug: "slot-4/冰火引爆", trigger: "火冰异常相遇时产生 5 米爆炸", interval: "2 秒", numericalId: "11010117", damageType: "技能伤害", damageValue: "135", toughness: 0, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1 },
  { name: "亲密间距", perkSlug: "slot-4/亲密间距", trigger: "单发全部弹片命中同一敌人", interval: "旧稿未注明", numericalId: "11010064", damageType: "技能伤害", damageValue: "450", toughness: 0, element: "电弧", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "亲密距离重复原型" },
  { name: "物法兼得", perkSlug: "slot-3/物法兼得", trigger: "技能伤害后 5 秒内，射击追加伤害", interval: "触发 5 秒；追加 0.25 秒", numericalId: "130103016", damageType: "间接伤害", damageValue: "上次技能伤害 × 35%", toughness: 0.35, element: "物理", critical: false, weakpoint: false, weakpointMultiplier: 1, note: "S3 超限卡，S4 当期卡池已移除" },
] satisfies readonly TriggerDamageEntry[];

const historical = [
  { name: "核爆（S2 历史）", trigger: "下一次射击命中至少 35 层元素异常的目标", interval: "基础描述 8 秒", numericalId: "执行资产已移除", damageType: "未确认", damageValue: "每层 150，上限 18000", toughness: "未确认", element: "未确认", critical: null, weakpoint: null, weakpointMultiplier: null },
] satisfies readonly TriggerDamageEntry[];

const bonds = [
  { name: "壁垒四件：破盾冲击", trigger: "护盾被打破时释放冲击波", interval: "2 秒", numericalId: "130103006", damageType: "技能伤害", damageValue: "2500", toughness: 5, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1 },
  { name: "狙击四件：近身爆炸", trigger: "受到伤害，或 5 米内怪物数达到 5 个时触发", interval: "20 秒", numericalId: "130103010", damageType: "技能伤害", damageValue: "5000", toughness: 10, element: "物理", critical: true, weakpoint: false, weakpointMultiplier: 1, note: "配置冷却为 20 秒；旧羁绊描述的 10 秒与执行配置不符" },
] satisfies readonly TriggerDamageEntry[];

// These are configuration records, not inferred perk/card identities or release claims.
const unassigned = [
  ["通用电击", "11010001", "300", "电弧", "武器技能伤害"],
  ["额外飞弹", "11010040", "217", "物理"],
  ["冰环", "11010042", "252", "寒冷"],
  ["落雷", "11010043", "217", "电弧"],
  ["额外飞弹 2", "11010044", "535.71", "物理"],
  ["电环 3", "11010053", "250", "电弧"],
  ["冰属性爆炸", "11010053_2", "180", "寒冷"],
  ["累计命中电环", "11010053_3", "750", "电弧"],
  ["命中落雷", "11010054", "200", "电弧"],
  ["命中火焰爆炸", "11010055", "180", "火焰"],
  ["命中腐蚀爆炸", "11010057", "180", "腐蚀"],
  ["受击电环", "11010058", "900", "电弧"],
  ["追踪弹（零基础系数）", "11010060", "0", "寒冷"],
  ["蓝色插件落雷", "11010062", "300", "电弧"],
  ["追踪弹", "11010066", "180", "物理"],
  ["关卡词条 1398001005 持续伤害", "11010081", "50", "腐蚀", "持续伤害"],
  ["关卡词条 1398001006 导弹", "11010082", "200", "物理"],
  ["关卡词条 1398001007 持续伤害", "11010083", "100", "火焰", "持续伤害"],
  ["关卡词条 1398001003 范围伤害", "11010092", "1500", "火焰"],
  ["关卡词条 1398001003 单体伤害", "11010093", "500", "火焰"],
  ["关卡词条 1398001015 冰环", "11010094", "3000", "寒冷"],
  ["关卡词条 1398001015 电环", "11010095", "3000", "电弧"],
  ["关卡词条 1398001020 虫群", "11010100", "250", "腐蚀"],
  ["关卡词条 1398001029 爆炸", "11010101", "43", "火焰"],
  ["樱花环", "11010120", "135", "物理"],
  ["捡货炸环", "11010127", "500", "物理"],
  ["泡爆增伤", "11010124", "500", "物理"],
  ["殉爆连锁", "11010145", "90", "物理", "爆炸伤害"],
  ["过热咆哮", "11010146", "125", "物理"],
  ["地裂", "11010147", "100", "物理"],
  ["裂能烙印", "11010148", "600", "物理"],
].map(([name, numericalId, damageValue, element, damageType]): TriggerDamageEntry => ({
  name: `${name}（${numericalId}）`,
  trigger: "未确认现行插件或卡牌归属",
  interval: "未确认",
  numericalId,
  damageType: damageType ?? "技能伤害",
  damageValue,
  toughness: 0,
  element,
  critical: false,
  weakpoint: false,
  weakpointMultiplier: 1,
  pending: "仅展示独立 Numerical 配置；触发条件、执行引用与投放状态未确认，不按同名插件建立关联",
}));

export const TRIGGER_DAMAGE_GROUPS = {
  current,
  overlimit,
  bonds,
  offline,
  prototype,
  unassigned,
  historical,
} satisfies Record<TriggerDamageGroup, readonly TriggerDamageEntry[]>;

export const TRIGGER_DAMAGE_ENTRIES: readonly TriggerDamageEntry[] =
  Object.values(TRIGGER_DAMAGE_GROUPS).flat();

const entriesByPerkSlug = new Map(
  TRIGGER_DAMAGE_ENTRIES.flatMap((entry) =>
    entry.perkSlug ? [[entry.perkSlug, entry] as const] : [],
  ),
);

const entriesByOverlimitId = new Map(
  TRIGGER_DAMAGE_ENTRIES.flatMap((entry) =>
    entry.overlimitId ? [[entry.overlimitId, entry] as const] : [],
  ),
);

export function getTriggerDamageByPerkSlug(slug: string) {
  return entriesByPerkSlug.get(slug);
}

export function getTriggerDamageByOverlimitId(id: string) {
  return entriesByOverlimitId.get(id);
}

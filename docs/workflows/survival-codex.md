# 生存战图鉴数据

状态：active。入口：`scripts/survival/project-codex.ts`；页面 `/survival`（`app/(pages)/survival/`），条目深链为 `#skill-<id>`、`#passive-<id>`、`#special-<id>`，搜索索引按同一格式生成。

“生存战”是时空猎场（STH）的 Survival 模式。游戏内图鉴的数据源是 `Survival_BuffShow`，其中 `AtlasType=1` 为主动技能，`AtlasType=2` 为被动与特殊增益。站点只读取已提交的 `data/survival/codex.json` 与 `public/icons/survival/`，运行时不依赖 `refs/`。

## 数据链路

```text
refs/Exports/NZM/Content/DataTables/TimeTravelHunt/
  Survival_BuffShow.json          图鉴条目与展示顺序
  STH_RoguelikeBuffTable.json     技能、升级、终极、被动、特殊增益
  STH_RoguelikeBuffLimitTable.json  携带上限与终极抽取参数
refs/Exports/NZM/Content/DataTables/UMGStyle/
  NZSlateColorStyleInfoDataTable.json  标签颜色样式（TagColor → 十六进制）
refs/Exports/NZM/Content/Blueprints/Affixes/MGE/SurvivalMode/   MGE 蓝图存在性校验、伤害资产引用
  Spawnable/ 与 AIBehavior/PlayerDevice/ 召唤物       伤害 Numerical 配置键
refs/Exports/NZM/Content/DataTables/numerical_config_composite.json  伤害 Numerical 行
refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json  特殊增益 Buff 的持续时间与 Modifier ID
  → scripts/survival/project-codex.ts
  → data/survival/codex.json + public/icons/survival/*.webp
  → lib/survival-codex.ts（Buff 效果经 data/num-modifier-lock.json 解析）
  → app/(pages)/survival/
```

## 结构

- `skills`：8 个主动技能。`levels` 为基础技能加 `UpgradeTree` 的 4 级，下标 + 1 即等级；`ultimate` 为终极进化，`passiveId` 为触发进化所需的配套被动。
- `passives`：12 条被动链（每条 5 级）。`combinesWithSkillId` 非空表示与某主动技能组合触发进化，空表示独立被动；`atlas` 非空表示在游戏图鉴中单独露出（4 条）。
- `specials`：`tempBoost`（饱和打击等，`targetSkillIds` 由 MGE ID 反查）、`trigger`（残暴狂热、三相共振）、`allMaxReward`（全满级后的急救包，不在图鉴中）。
- `damageSources`（技能与特殊增益）：蓝图实际挂载的伤害 Numerical 行，`scope` 区分基础形态与终极新增来源。
- `buff`（特殊增益）：MGE 实际添加的 Buff，保存名称、持续时间和 `GPModifyIDs`；效果值不入库，页面由 Num Modifier Resolver 解析。
- `rules`：携带上限和终极抽取参数，字段名沿用源表，不做语义改写。

升级链、终极前置、技能与被动互指、MGE 蓝图、图标和条目数量在投影时全部校验，任何一项不符直接失败。

## 数值边界

页面只说源表直接表达的关系：升级顺序、终极前置、配套被动、临时进化的出现条件与目标技能。“临时进化后等同于终极技能”这类推断没有证据，不要写进页面。

`numericalStatus` 固定为 `display-only`，只描述 `description`、`currentLevelDescription` 和 `attributeDisplays`：它们是源表的展示层文本，没有沿 MGE → GPModifier → `numerical_modifier_config.json` 身份链核验。升级加伤走 `MGE_MW_MainSkillBase.LevelDamageModifier` 等 `CoefValue: 1` 的 Modifier，具体系数由蓝图运行时传入，页面或其它数据不得把描述里的百分比当作配置真值引用。逐级伤害需要 `kismet/` 证据，另行立项。

### 伤害来源

`damageSources` 是例外，来自 Numerical 配置真值。`project-codex.ts` 的 `DAMAGE_SPECS` 按技能登记资产与配置键：投射物、轰炸和召唤物读 `TacticalUnitComponent.DefaultNumericalConfigs`，飞刃、冲击环和残暴狂热读 MGE 默认对象上的 `*NumericalID` 属性。投射物常规命中经 `BP_MW_ProjectileBase` 调用 `TacticalUnit.ApplySettlementFromHit`，AOE 也从 TacticalUnit 取结算句柄，所以不采用旧的 `NamedThrowableSettlementConfig`（`120300111`、`190330001`）；但减速球在飞行 6000 距离时还有一个按旧配置 `Damage` 施放 AOE `1003011001` 的事件，是否执行记为 pending。回旋猎刃的 3500 距离事件只负责回旋返程，不结算伤害。投影时逐项校验：资产被所属 MGE 引用、键唯一命中非零 ID、`numerical_config_composite` 行存在、只有一个伤害类 Health 结算、元素可识别、`HpCalBase` 与 `ToughnessScale` 为 0；基础形态展示第 1 级，其余等级若有差异必须由终极条目显式认领，否则失败。破韧只在挂有 `Toughness.Base` 结算时投影。

页面按 `HpCalScale × 500` 换算伤害，不在页面另行标注假定值。500 沿用猎场独立伤害，生存战尚未证实：生存战副本走 `PlayerGameModeConfig` 第 22 行（`HumanBalanceID=1009`），该平衡组没有攻击行；`Attack=500` 只出现在其它平衡组，`SkillDamage` 的最终公式在 Native 中。确认前不要改成 330、1 或其它推测值。数值不含升级、被动和临时进化加成。

`pending` 记录未闭合的证据，2026-11-04 的核验结论见 Kismet 快照 `kismet/unknown/20261104T095647Z-bf2e548c6dd1466e85af8492f6f7bf09/`（来源标记为 unknown，只作执行线索）：

- 电磁溅射：配置系数与固定值均为 0，可见蓝图直接按 `SplashDamage` 结算、未发现补值，Native 待核验。不要写成“溅射无伤害”。
- 终极电磁直击：蓝图按内部等级 +1 设置 Numerical 等级，终极参数 `5` 对应第 6 行；参数解析的 Native 实现待核验。第 6 行破韧 43.2 是第 1 行的 3 倍（+200%），与描述“破韧效率增加 300%”冲突，以 Numerical 为准。
- 残暴狂热：`DT_MGEParamConfig_Main#1511021001` 的 `TargetDamage=10000`、`ExtraDamageRatio=10`；蓝图在 `CalculateDamage ≥ 10000` 时以 `10 × CalculateDamage` 发起 `191810016` 追加结算，并排除自身结算再次触发。`CustomDamage` 的后续消费待核验，页面显示“动态”，不能按 `1 × 500` 换算。
- 哨卫高能弹药：开火时按 `UsePowerfulAmmo` 或 `BulletMustBeRed` 切换到高能武器槽，两个标志的设置条件未闭合，不能归因于终极或临时进化。
- 减速球：爆炸的旧配置距离事件见上；`MiddleAOEDamage` 未找到完整的消费链。

三相共振不属于独立伤害：`MGE_1511022001_TripleDamage.DamageBuff` → `BuffConfigDatatableNew#Survaivl_TripleDamageOP`（持续 10 秒）→ Modifier `191810016`（`DamageRatio`、`B1`、`BaseValue=5`），即 +500%，单独作用时为 ×6，与描述“伤害×5”冲突，以配置为准。`BUFF_SPECS` 按条目登记 MGE 上实际被 `AddBuff` 使用的属性，投影时校验 Buff 行存在且挂有 Modifier；`resolveSurvivalBuffEffects()` 经 Resolver 解析为“游戏模式乘区 +500%”，详情的「配置效果」分段与描述并列展示。残暴狂热的 `DamageBuff=Survaivl_SingleDamageOP` 未被字节码使用，指向的 Modifier `191810015` 也不在 Lock 中，不登记。

新增技能或伤害资产变化时先更新 `DAMAGE_SPECS`。

## 刷新与校验

```bash
pnpm survival-codex:project
pnpm survival-codex:check
pnpm test:survival-codex
```

`project` 重写 JSON 并转换图标；`check` 重新投影并要求已提交数据和图标字节一致，同时拒绝未被引用的旧图标。只改数据可加 `--data-only`。源表升级（新赛季或补丁）后先运行 `check`，失败时看是数量断言还是链路断言：新增技能需要同步 `project-codex.ts` 里的规模断言与测试。

此流程不进入 `pnpm sync`，与 Origin 数据一致，需要时显式刷新。

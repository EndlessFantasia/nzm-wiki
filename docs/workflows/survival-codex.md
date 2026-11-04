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
  → scripts/survival/project-codex.ts
  → data/survival/codex.json + public/icons/survival/*.webp
  → lib/survival-codex.ts
  → app/(pages)/survival/
```

## 结构

- `skills`：8 个主动技能。`levels` 为基础技能加 `UpgradeTree` 的 4 级，下标 + 1 即等级；`ultimate` 为终极进化，`passiveId` 为触发进化所需的配套被动。
- `passives`：12 条被动链（每条 5 级）。`combinesWithSkillId` 非空表示与某主动技能组合触发进化，空表示独立被动；`atlas` 非空表示在游戏图鉴中单独露出（4 条）。
- `specials`：`tempBoost`（饱和打击等，`targetSkillIds` 由 MGE ID 反查）、`trigger`（残暴狂热、三相共振）、`allMaxReward`（全满级后的急救包，不在图鉴中）。
- `damageSources`（技能与特殊增益）：蓝图实际挂载的伤害 Numerical 行，`scope` 区分基础形态与终极新增来源。
- `rules`：携带上限和终极抽取参数，字段名沿用源表，不做语义改写。

升级链、终极前置、技能与被动互指、MGE 蓝图、图标和条目数量在投影时全部校验，任何一项不符直接失败。

## 数值边界

页面只说源表直接表达的关系：升级顺序、终极前置、配套被动、临时进化的出现条件与目标技能。“临时进化后等同于终极技能”这类推断没有证据，不要写进页面。

`numericalStatus` 固定为 `display-only`，只描述 `description`、`currentLevelDescription` 和 `attributeDisplays`：它们是源表的展示层文本，没有沿 MGE → GPModifier → `numerical_modifier_config.json` 身份链核验。升级加伤走 `MGE_MW_MainSkillBase.LevelDamageModifier` 等 `CoefValue: 1` 的 Modifier，具体系数由蓝图运行时传入，页面或其它数据不得把描述里的百分比当作配置真值引用。逐级伤害需要 `kismet/` 证据，另行立项。

### 伤害来源

`damageSources` 是例外，来自 Numerical 配置真值。`project-codex.ts` 的 `DAMAGE_SPECS` 按技能登记资产与配置键：投射物、轰炸和召唤物读 `TacticalUnitComponent.DefaultNumericalConfigs`，飞刃、冲击环和残暴狂热读 MGE 默认对象上的 `*NumericalID` 属性。投射物上旧的 `NamedThrowableSettlementConfig`（`120300111`、`190330001`）不采用。投影时逐项校验：资产被所属 MGE 引用、键唯一命中非零 ID、`numerical_config_composite` 行存在、只有一个伤害类 Health 结算、元素可识别、`HpCalBase` 与 `ToughnessScale` 为 0；基础形态展示第 1 级，其余等级若有差异必须由终极条目显式认领，否则失败。破韧只在挂有 `Toughness.Base` 结算时投影。

页面按 `HpCalScale × 500` 换算伤害，与猎场独立伤害一致，但生存战基础攻击尚未实测；数值不含升级、被动和临时进化加成。`pending` 记录未闭合的证据：电磁溅射 `HpCalScale` 为 0、终极电磁直击按第 6 级推断、残暴狂热为 `CustomDamage`（显示“动态”，描述的 1000% 未核验）、哨卫高能弹药的使用条件未确认。新增技能或伤害资产变化时先更新 `DAMAGE_SPECS`。

## 刷新与校验

```bash
pnpm survival-codex:project
pnpm survival-codex:check
pnpm test:survival-codex
```

`project` 重写 JSON 并转换图标；`check` 重新投影并要求已提交数据和图标字节一致，同时拒绝未被引用的旧图标。只改数据可加 `--data-only`。源表升级（新赛季或补丁）后先运行 `check`，失败时看是数量断言还是链路断言：新增技能需要同步 `project-codex.ts` 里的规模断言与测试。

此流程不进入 `pnpm sync`，与 Origin 数据一致，需要时显式刷新。

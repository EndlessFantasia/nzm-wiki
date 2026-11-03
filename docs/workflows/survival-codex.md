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
refs/Exports/NZM/Content/Blueprints/Affixes/MGE/SurvivalMode/   MGE 蓝图存在性校验
  → scripts/survival/project-codex.ts
  → data/survival/codex.json + public/icons/survival/*.webp
  → lib/survival-codex.ts
  → app/(pages)/survival/
```

## 结构

- `skills`：8 个主动技能。`levels` 为基础技能加 `UpgradeTree` 的 4 级，下标 + 1 即等级；`ultimate` 为终极进化，`passiveId` 为触发进化所需的配套被动。
- `passives`：12 条被动链（每条 5 级）。`combinesWithSkillId` 非空表示与某主动技能组合触发进化，空表示独立被动；`atlas` 非空表示在游戏图鉴中单独露出（4 条）。
- `specials`：`tempBoost`（饱和打击等，`targetSkillIds` 由 MGE ID 反查）、`trigger`（残暴狂热、三相共振）、`allMaxReward`（全满级后的急救包，不在图鉴中）。
- `rules`：携带上限和终极抽取参数，字段名沿用源表，不做语义改写。

升级链、终极前置、技能与被动互指、MGE 蓝图、图标和条目数量在投影时全部校验，任何一项不符直接失败。

## 数值边界

页面只说源表直接表达的关系：升级顺序、终极前置、配套被动、临时进化的出现条件与目标技能。“临时进化后等同于终极技能”这类推断没有证据，不要写进页面。

`numericalStatus` 固定为 `display-only`。`description`、`currentLevelDescription` 和 `attributeDisplays` 是源表的展示层文本，没有沿 MGE → GPModifier → `numerical_modifier_config.json` 身份链核验；`MGE_1511…` 是 Blueprint 逻辑，当前 Numerical 中没有直接命中的行。页面或其它数据不得把这些数值当作配置真值引用。核验需要 `kismet/` 证据，另行立项。

## 刷新与校验

```bash
pnpm survival-codex:project
pnpm survival-codex:check
pnpm test:survival-codex
```

`project` 重写 JSON 并转换图标；`check` 重新投影并要求已提交数据和图标字节一致，同时拒绝未被引用的旧图标。只改数据可加 `--data-only`。源表升级（新赛季或补丁）后先运行 `check`，失败时看是数量断言还是链路断言：新增技能需要同步 `project-codex.ts` 里的规模断言与测试。

此流程不进入 `pnpm sync`，与 Origin 数据一致，需要时显式刷新。

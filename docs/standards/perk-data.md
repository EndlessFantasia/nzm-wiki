# 插件数据管线与维护约定

> 状态：active

本文记录武器插件的身份、描述、图标、适用范围和上线状态处理规则。目标是让后续版本更新只需要重新审计和人工确认，不再重复排查同一套数据关系。

## 核心结论

- `data/perks/slot-*/*.mdx` 拥有正式普通插件详情和结构化效果。预览编辑源独立放在 `data/perk-preview/slot-*/*.mdx`，`data/perk-preview/preview.json` 拥有已审定的预览发布投影。`data/overlimit/current.json` 拥有已审定的超限发布投影。超限可通过 `perkItemId` 显式关联同通道插件，但不在运行时合并插件描述、数值或独立伤害。赛季流程见 [超限维护](../workflows/overlimit-season.md)。
- 插件身份只通过 ItemID 连接，不能根据相似编号、图标编号或相邻行猜测。
- 普通插件详情优先使用 `MGEDescription`；猎场 `OverrideDesc` 通常是玩法卡片简写，不能覆盖完整详情。
- 游戏内截图、`MGEDescription`、`OverrideDesc` 和各表 `Description` 都是自然语言展示证据，不是配置数值真值；它们只能确定玩家可见文案、触发条件和语义。
- 已有非空描述不批量覆盖。版本更新后重新审计，人工处理真正冲突即可。

## 数值证据规则

插件和超限卡片的数值先沿 `ItemID -> PassiveSkill_ID -> MGE -> ModifierID` 定位到 Num Modifier V2 Lock 的精确 `lc:<row_name>`。只要目标效果存在可对应的 Numerical 属性行，就必须以该行的 `BaseValue`、`CoefValue`、`GPModifierOp` 和 `Level` 为准，禁止从游戏内描述、截图文案、`MGEDescription`、`OverrideDesc` 或 Numerical 自身的 `Description` 抄取数值。

- `Description` 只解释属性语义，不校正同一行的结构化字段。例如 `GPModifierOp: B1`、`BaseValue: 3.0` 应记录为 `+300%`；描述即使写 `+400%` 也视为错误文案。
- 描述与 Numerical 冲突时，采用 Numerical，并在审计证据中记录冲突；不得以描述“看起来更新”或来自游戏内为由覆盖结构化值。
- 只有 Numerical 没有承载目标数值，或有可重复的实际伤害测试、运行时日志证明存在动态覆写时，才允许采用其他数值证据。此时必须记录证据来源、推导过程和 Numerical 链路为何不足，不能只设置 `description_override: true`。
- 概率、持续时间、范围、弹数、层数等若由其他结构化 Ability、Buff 或 DataTable 字段直接承载，同样优先结构化字段，描述仅作交叉检查。
- `refs/` 仍只用于维护期审计；最终发布值由 MDX 中的稳定表达式引用已提交的 `data/num-modifier-lock.json`，页面运行时不得读取 `refs/`。

## 身份链路

```text
CommonItemDataTable[ItemID]
  ├─ Name.LocalizedString       正式名称
  └─ IconPath.NormalIcon        普通插件图标
            │
            │ 同一个 ItemID
            ▼
WeaponModItemData[MODItemID]
  ├─ MODSlotIndex               插槽
  ├─ PassiveSkill_ID            描述和效果入口
  ├─ SuitableWeaponType         标准武器类型
  ├─ SuittableWeaponItem        专属武器 ItemID
  ├─ CollectMODItem             是否进入收集/展示范围
  ├─ MakeMODItem                是否可制造
  └─ IsCooked                   是否参与客户端打包
            │
            │ PassiveSkill_ID: 技能ID:等级
            ▼
MGEPassive_BD[技能ID_等级]
            │
            ▼
DT_GPMGESkillDesConfig_BD[技能ID_等级].MGEDescription
```

禁止的关联方式：

- 用 `IconPath` 中的 MGE 编号反推 ItemID
- 因为编号接近就把 `20703040114` 当作 `20703040184`
- 用 `PassiveSkill_ID` 代替 ItemID 查 CommonItem
- 同名存在多个版本时静默选择最后一条

同名多版本应优先唯一的 `CollectMODItem=1` 条目；仍有多个可收集候选时必须改用 `--ids`。

## 描述来源

### 来源优先级

| 优先级 | 来源 | 用途 |
|:---|:---|:---|
| 1 | 当前版本游戏内详情截图 | 玩家可见文案和触发语义；数值仍受“数值证据规则”约束 |
| 2 | `DT_GPMGESkillDesConfig_BD.json` 的 `MGEDescription` | 普通插件完整详情正文；不作为结构化数值依据 |
| 3 | `DT_GPMGESkillDesConfigTable_Main.json` | 导入器使用的合并镜像，需与 BD 表核对 |
| 4 | `HuntingGroundRoguelikeWeaponModTable.OverrideDesc` | 猎场卡片简写，仅作差异对照，不作为结构化数值依据 |
| 5 | `WeaponModItemData.AttrList` | 没有 MGE 描述时的属性型回退；其中结构化字段按数值规则审计 |

`CommonItemDataTable.Description` 是通用插件背景介绍，不是插件效果描述。`PreviewDescription` 经常为空，也不能当主要来源。

### 用截图反查原始表

当用户给出若干游戏内插件详情截图时：

1. 从两个以上已确认插件中提取有辨识度的完整短句。
2. 用 `rg --fixed-strings` 在 `refs/Exports/NZM/Content/` 搜索。
3. 确认这些短句共同落在哪张原始表，不从单个目标的候选文案中猜。
4. 按目标 ItemID 找到 `PassiveSkill_ID`，转成 `技能ID_等级` 行键。
5. 在同一张表中读取目标的 `MGEDescription`。

2026-07-14 已用异态共鸣、相位强袭、冥河送葬、兽躯双衍、幸运龙炎和肾上腺素截图确认：武器插件详情正文来自 `DT_GPMGESkillDesConfig_BD.json`。

### 描述差异分类

| 分类 | 判断 | 处理 |
|:---|:---|:---|
| 内容一致，仅省略细节 | 机制和关键数值一致 | 不改 |
| 机制一致，但猎场描述严重残缺 | Override 省略重要触发、范围、层数或持续时间 | 使用完整 MGE 描述 |
| 描述严重残缺，且可能存在矛盾 | Override 与 MGE 机制相近但数值签名不同 | 结合截图、Buff、Ability 或运行时配置修正 |
| 真正冲突 | 触发方式或关键数值互相排斥 | 列清单，等待人工决策后修改 |

不能因为 MGE 更长就自动覆盖，也不能因为 Override 更像短卡片文案就认定它更新。

### 已确认案例

| 插件 | MGE 行键 | 采用结果 |
|:---|:---|:---|
| 致命爆炸 | `1316200001_1` | 当前MGE为`5%`概率、配置冷却`0.1`秒；AOE半径8米，`130103014_1.HpCalScale=10`；拒绝旧文案与触发条目的8%、1/2秒及5/10米。证据见`architecture/balance-evidence.md` |
| 武器穿透 | `1316201001_1` | 子弹穿透能力 `+2` |
| 导弹轰炸 | `1316210001_1` | 爆炸命中发射 `2` 枚；仅命中一个单位时发射 `5` 枚，冷却 `2` 秒；拒绝旧 MGE 文案的 `3` 枚 |
| 换弹冲击 | `1316211001_1` | 持续 `5` 秒，基础 `500%` 攻击力；每 `1%` 暴击率或换弹速度提高 `1%` 伤害 |
| 爆毒蚀域 | `1316213001_1` | 暴击生成减速毒域，冷却 `5` 秒 |
| 肾上腺素 | `1313031004_1` | 季中更新公告优先：每颗 `21%`，最高 `126%` |

MGE 中的“复用某武器资源”等开发备注不写入网站描述，只保留玩家可理解的机制和数值。

## 文案格式

MDX 正文和 `description` 直接说明已收录的插件效果。配置差异、审核过程和缺失链路记录在证据文档，不把“待核实”“暂不计入”等维护提示混入效果描述。省略缺少依据的参数不表示其值为零或机制不存在；数值引用、来源等级和发布状态仍按本规范维护。已有补充记录见 [内容来源补充记录](../architecture/content-evidence-notes.md)。

普通插件详情与超限卡片短摘要是两个独立展示面：

- 普通插件详情的数值强调使用 `<strong>...</strong>`，例如 `<strong>20%</strong>`；冷却统一写为 `，冷却时间<strong>20</strong>秒。`，不使用 `CD20秒` 缩写。
- 超限卡片短摘要保持紧凑纯文本，可以使用 `（CD2秒）`；不得把该格式批量改写成普通插件详情句式，也不得反向用短摘要覆盖详情。
- 游戏标签 `<qiangdiao>...</>` 转换为 `<strong>...</strong>`。
- 清理 `U+200B`、`U+FEFF` 等零宽字符。
- 不保留 `{GPModifier:...}`、`??`、独立占位符 `X` 或测试文案。
- 触发语义以游戏原文为准，例如“切出该武器后”不能擅自改成“切换到该武器后”。

需要人工维护玩家可见文案时，在 MDX 中添加：

```yaml
description_override: true
```

## 超限短摘要维护

超限正式短摘要发布在 `data/overlimit/current.json`，过渡期下一版使用独立的 `data/overlimit/preview.json`；同 ID 的两版数据不能互相覆盖。版本更新先用 `pnpm overlimit prepare` 生成独立候选，再审定数值和文案。`OverrideDesc` 仅作为展示证据，不能覆盖 Numerical 真值。旧 `import-overlimit-cards.ts` 及其中审定映射已经退役，S3.2 审定结果已保存在发布投影与本地归档。

超限预览卡片和羁绊的 Modifier 来源须携带显式预览 `season`，并使用该季选定 Numerical 证据。数值未核验完的预览卡片声明 `verification: { status: "partial", note: "具体缺口" }`，不得展示推测数值或沿用 S3 数值。羁绊按真实档位组合分组，不在组件中硬编码某季名称；羁绊与地图轮换随超限投影一同归档。操作见 [超限维护](../workflows/overlimit-season.md#重建已审定的超限预览)。

新增或修改审定短摘要时按以下顺序维护：

1. 先记录身份链、结构化数值或运行时证据，并确认原 `OverrideDesc` 的具体问题。
2. 能进入 `effect_values` 的 Numerical 数值先维护 MDX V2 引用；概率、冷却、范围和弹数等使用对应结构化执行配置。
3. 将审定来源的已解析效果和短摘要生成到候选发布投影，按超限维护流程检查与激活。不得直接把预下载原文抄入当前投影，或用插件更新隐式刷新超限。
4. 检查卡片短摘要与插件详情各自保持合适粒度，随后运行 `pnpm test:overlimit-cards`、`pnpm overlimit-effects:audit` 和 `pnpm num-modifier:check`。

## 结构化效果数值

普通插件需要展示具体数值时，在 MDX frontmatter 中维护 `effect_values`。关联超限卡可以在审定阶段复用同版本解析结果，但超限发布投影自行保存已解析效果和短摘要，运行时不读取当前插件。独立技能卡不能伪造普通插件实体；其数值同样必须经过 Numerical 身份链和来源登记审计。

```yaml
num_modifier_values:
  damage-per-stack:
    row: "lc:111010061_1_0"
    field: base
    scale: 1
  damage-at-six-stacks:
    row: "lc:111010061_1_0"
    field: base
    scale: 6

effect_values:
  - label: "弱点伤害"
    stages:
      - condition: "每层"
        value:
          ref: damage-per-stack
          format: signed-percent
      - condition: "叠满六层"
        value:
          ref: damage-at-six-stacks
          format: signed-percent
```

- 禁止手写 `kind`、`statId` 或 `modifierTypeId`。Num stages 的属性类型、方向、增伤/属性分组和索引分面统一由 `resolveEffect()` 派生。
- `num_modifier_values` 的别名使用 kebab-case；`row` 必须是 `lc:` 引用，`field` 只允许 `base` 或 `coefficient`，`scale` 默认 `1`。
- 描述中的 Num 数值使用 `{{num:<alias>|<format>}}`，格式只允许 `number`、`percent`、`signed-number`、`signed-percent`。插件详情、插件悬浮预览、召唤物摘要和攻略编辑器消费 `lib/perks.ts` 的已解析描述；超限可在审定阶段复用同版本 `effect_values` 解析结果，运行时只读自己的发布投影和短摘要。
- `value` 和每个阶段均不能为空；`condition` 可省略，`label` 可用于覆盖上下文展示名。Num 派生值使用 `{ ref, format }`；无法直连 Num 的值使用 `{ literal, reason }`，并在 effect 上声明 `semantic.facetId`。旧字符串 `value` 禁止使用。
- 数值必须遵守“数值证据规则”。可定位 Numerical 行时必须引用 Num Modifier V2 表达式；MDX `description` 与 `description_override: true` 均不能覆盖结构化数值。属性通道和索引分面同样不得由描述覆盖。
- 同一插件不能重复解析为同一个分面。没有登记为 Modifier 来源的超限卡片不得孤立添加增伤数值。
- 属性效果由语义目录扩展，不维护第二份允许列表。命中后直接回复技能能量等即时充能不属于充能效率，基础射击间隔变化也不能仅凭文案归为射速。
- 页面只渲染非空分类，不显示空入口。列表与增伤共用关键数值区域，详情页按“增伤”和“属性”分组展示。

维护时先确认 ItemID 和结构化数值链，再录入阶段数值；描述只用于补充条件语义。随后运行 `pnpm num-modifier:check`、`pnpm test:overlimit-cards`、`pnpm overlimit-effects:audit` 与 `pnpm multiplier-index:check`。超限卡片导入后重复执行校验，确认 Numerical 审定值没有被描述覆盖。

## 替换主动技能

插件使用 `skill_variants` 引用 [Num 技能协议](weapon-skills.md) 的显式变体，不再手填技能参数快照：

```yaml
skill_variants:
  - weapon_slug: 雷霆之影
    base_skill: active-1
    variant: s4-preview:5104901
    operation: replace
```

武器内技能 ID、原游戏技能 ID、变体游戏技能 ID、发布通道必须分别吻合。变体目录 `data/num-skill-variants.json` 声明原技能身份和参数引用，`data/num-skill-lock.json` 保存选定原表行及哈希；`replacement_skill` 已退役并在导入时拒绝。同ID修改主动效果使用 `operation: modify`；通用武器主动替换使用 `scope: all-weapons-active` 并省略 `weapon_slug`、`base_skill`，不伪造武器身份。参数链路见[插件变体证据](../architecture/perk-skill-variant-evidence.md)。

充能和层数遵循武器技能充能来源优先级，持续时间与暂停充能单独核验执行配置，不能从描述推断。预览通过 `pnpm perks:project --channel preview` 冻结同版 `skillVariants`，运行时不回落到正式技能、不重算编辑源。随后运行 `pnpm num-skills:project` 更新双向索引。详情在效果数值区域仅显示 CD、持续时间、阻回三项；列表和悬停预览不增加标签或技能参数。

## 独立伤害来源

插件额外创建或替换为独立 Numerical 结算时，在插件 MDX 中使用 `independent_damage_sources` 引用已经审定的武器 `damage_sources`：

```yaml
independent_damage_sources:
  - weapon_slug: "夜影之逝"
    damage_source_id: "guan-chang-hong-jian-qi"
    trigger: "切出本武器时向前发射剑气"
    interval: "10秒"
```

- `weapon_slug` 使用 `data/weapons/` 下不含扩展名的文件名；`damage_source_id` 使用该武器内稳定的伤害来源 ID。
- 插件详情直接解析该引用。超限在审定阶段使用相同武器 Resolver 生成 NumericalID、伤害类型、伤害数值、破韧、元素、暴击和弱点，保存到当前版本的独立伤害投影；不能在页面运行时借用已更新的插件或武器数值。
- `trigger` 与 `interval` 是插件自身的触发语义，必须依据最终描述或执行配置人工维护；没有独立冷却时明确写触发方式，不猜测冷却值。
- 只有插件新增或切换到独立 Numerical 伤害时才登记。修改原武器伤害倍率、弹丸数量、范围、射速，或让原有武器伤害来源覆盖更多攻击，不属于独立伤害来源。
- `effect_values` 仍只记录增伤和属性提升，不能用它承载新伤害实例。

新增或修改引用后运行 `pnpm test:independent-damage` 与 `pnpm weapon-data:check`。

### 预览插件的武器伤害来源

极寒领域、极寒之触、极寒之痕分别引用极寒冰神的 `cold-field`、`cryo-touch`、`ice-orb`。完整原始行和来源 SHA-256 统一保存在 Weapon Lock，预览发布投影保存当次解析的独立伤害结果和依赖文件哈希。刷新武器来源使用 [Weapon Data Lock 单武器刷新](../architecture/weapon-data-lock.md#单武器局部刷新)，避免混入其他武器的预载变动。

发布阶段由 `lib/perk-preview-damage.ts` 沿预览条目审定的 `independent_damage_sources` 解析，不硬编码赛季、ItemID 或武器名。描述中的 `GPNumericalID:…:HpCalScale:13` 必须唯一匹配插件独立引用指向的猎场 Numerical；通过 `lib/weapons.ts` 同步服务入口取得 Resolver 已应用 MDX overrides 的伤害系数，不直接读取武器 frontmatter 或 Lock。独立伤害同样使用通用武器 Resolver，类型、破韧、元素、暴击和弱点不设置预览专用默认值。缺少独立引用、引用不匹配、歧义或不支持的 Token 均报错。发布后页面只读取冻结结果，不随共享武器数值变化刷新。

预览编辑 MDX 拥有发布用 `independent_damage_sources`；`scripts/s4-preview-perks-review.json` 保存已登记条目的审定引用，供预览生成器重跑时恢复并预检。生成器不刷新 Weapon Lock，需先完成武器导入和 Lock 校验，再生成预览插件。每次运行 `pnpm perks:project --channel preview` 前，重新核对引用武器及 Lock 是否符合目标版本；来源哈希用于追溯，不能证明后来更新的武器仍适用于旧预览。

## 适用武器

适用范围分为三类：

| 类型 | MDX 表达 |
|:---|:---|
| 全部武器 | `weaponType: []`，且没有 `weaponNames` |
| 标准武器类型 | `weaponType: [类型ID...]` |
| 武器专属插件 | `weaponType: []` 加 `weaponNames: ["武器名"]` |

`weaponType: []` 不一定代表全部武器。只要 `SuittableWeaponItem` 非空，就必须解析对应 CommonItem 正式名称并写入 `weaponNames`。例如剑摧魂属于夜影之逝专属，不能显示为全部武器类型。

## 图标

- 普通页面图标以同一 ItemID 的 `CommonItemDataTable.IconPath.NormalIcon` 为准。
- 猎场表可能使用另一张 Rogue 图标，只在复刻猎场界面时采用。
- 图标编号和 `PassiveSkill_ID` 不一致是正常告警，不能互相替代。
- 必须同时维护 `public/icons/perks/*.png` 和网站实际请求的 `public/webp/icons/perks/*.webp`。
- 同名目标文件已存在时先比较内容；内容不同就使用带 ItemID 的稳定文件名，不能覆盖合并。

## 上线状态

| 字段 | 含义 |
|:---|:---|
| `CollectMODItem=1` | 进入插件收集和展示范围，网站归入“已上线” |
| `MakeMODItem=1` | 可进入插件制造范围，不能单独判断上线 |
| `IsCooked=true` | 资源已打包，不代表已投放 |

猎场还有第二层开关：条目需要存在于 `HuntingGroundRoguelikeWeaponModTable` 且 `IsShow=true`。这不能反向证明普通插件详情应使用 `OverrideDesc`。

核对游戏内已上线截图时，以截图中的插件名称为观察事实，先与现有 MDX 对照；refs 只用于在身份确定后补字段，不能直接用 refs 全量列表代替截图清单。

### release_date 与近期上新

正式上线的插件可以在 MDX 中记录最近一次游戏内上线日期：

```yaml
CollectMODItem: 1
release_date: "2026-07-24"
```

- `release_date` 使用北京时间下的 `YYYY-MM-DD` 自然日，不使用文件修改时间、Git 提交时间或 refs 更新时间推断。
- 插件图鉴将上线当天至第 7 个自然日视为“近期上新”，即日期差为 `0` 至 `6` 天；第 8 天自动失效。
- 字段缺失的旧插件不进入近期筛选；`CollectMODItem` 不是 `1` 时，即使保留日期也不会进入近期筛选。
- 插件下线后可以保留该字段作为历史信息；以后重新上线时，将其更新为最近一次正式上线日期。
- 批量同步上线状态时使用 `--release-date`，导入器只会在状态从未上线变为已上线时写入日期，不会覆盖已经上线插件的既有日期。

## 导入与审计

主要入口：

```bash
pnpm exec tsx scripts/import-perks.ts 插件名 --json
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
pnpm exec tsx scripts/import-perks.ts --all --sync-descriptions --json
pnpm exec tsx scripts/import-perks.ts --all --sync-status --release-date 2026-07-24 --json
pnpm exec tsx scripts/import-perks.ts --all-with-icons --json
```

写入前检查：

- `identityWarnings.idConflicts`
- `identityWarnings.nameConflicts`
- `descriptionAudit.mge`、`override`、`sourceNumbers`
- `drifts.icon`
- `drifts.weaponType` 和 `drifts.weaponNames`
- `local.hidden` 与 `CollectMODItem`

普通 `--write` 不覆盖已有非空描述。只有空描述或明确占位符才允许 `--sync-descriptions --write` 保守修复。

## 下一赛季预览导入

预览是 SN 未结束、SN+1 选定内容已经完成编辑和核验的过渡阶段，遵循 [跨赛季版本管理](../workflows/content-versions.md#过渡期当前正式版与下一版预览并存)。先在版本配置登记预览赛季、版本号和显示名称，再用 `<season>-preview` 标记条目与 Modifier 来源。图鉴 `/perks` 展示正式插件，`/perks/preview` 展示已发布预览，标题上方使用 **S3.2 / S4 Preview** 两个版本按钮切换；快速筛选中不再设置 Preview，也不增加卡片预览标签。`CollectMODItem`、`MakeMODItem`、`IsCooked` 保留预载表原值，不能把预载开关当作正式上线日期。预览插件全部纳入乘区覆盖检查，使用显式绑定赛季的独立 Numerical 证据；正式上线时必须重新审计。

2026-09-16 预载新增 78 个普通插件；12 个 `MODItemType=1`、通过 `RoutineItemID` 关联旧插件的腐化变体不单独作为普通插件导入。同名“连锁充能”保留两个 ItemID，新版文件使用 `连锁充能-20703040513.mdx`。

维护时先用 `import-perks.ts --content-root <Content目录> --ids <审定ID列表> --season s4-preview --write` 建立草稿，再运行：

```bash
pnpm exec tsx scripts/prepare-perk-preview.ts --content-root <Content目录> --icon-root <参考图标目录> --review scripts/s4-preview-perks-review.json
pnpm perks:project --channel preview
pnpm perks:check
```

`--review` 指向本次审定清单，S4 使用 `scripts/s4-preview-perks-review.json` 保存 ItemID、身份链、文案替换、武器独立伤害引用和未确认项。导入器在 `--season *-preview` 时仅写入 `data/perk-preview/slot-*`；准备器也只修改此目录。它从版本配置读取预览目标，从指定目录原地读取数据，预检通过后生成编辑 MDX、PNG、WebP 和 `data/perk-preview-modifiers.json` 中绑定该赛季的选定 Modifier 行。Num 模板由独立预览 Resolver 解析；已导入武器的伤害 Token 使用审定的武器引用与 Weapon Lock。生成器不刷新两类正式 Lock。未能通过执行配置核验的预览文案不转换为 `effect_values`。下一赛季替换配置和审定清单，复用同一生成器。

编辑完成后，`perks:project --channel preview` 才将解析后的插件、正文、metadata 和独立伤害写入 `data/perk-preview/preview.json`，并记录来源哈希；修改编辑 MDX 不会自动更新页面。`perks:check` 检查 Schema、预览配置和资源，构建也执行此检查。预览运行时不重新解析编辑 MDX 或读取共享武器数值。

同 ItemID 可在正式和预览通道各有一版，预览详情 slug 使用 `preview/slot-N/<名称>`。默认列表、名称和 ItemID 查询保持正式通道；发布列表可合并两版，显式指定 `preview` 才按名称或 ItemID 读取预览。S4 初次迁移了原有 82 个预览条目，随后加入贯长虹预览；这个集合只代表已审定预览，不表示所有正式插件已复制到 S4。撤下或转正须按[版本管理流程](../workflows/content-versions.md#过渡期当前正式版与下一版预览并存)逐项处理两版差异，不能靠修改 `season` 或整体覆盖共享 Lock 完成。

图标按本地同 ItemID 的 CommonItem 资源名匹配 `public/icons/perks/` 与 `public/webp/icons/perks/`；详情和数值以本项目预载证据、MDX 引用和预览 Numerical 行为准。S4 初始插件的索引审定维护在 `scripts/s4-perk-index-review.json`，每项记录本地身份链与精确 Numerical 引用，或明确的排除理由和证据缺口。其他项目只能作为实现参考，不能作为数值或乘区分类的验收依据。

## 版本更新流程

S4 正式图鉴的“赛季上新”和“季中上新”使用 `data/s4-new-perks.json` 的 81 个 ItemID 白名单，身份来自最终 S4 Preview 中 `preview_change: new` 的条目；状态使用当前正式 MDX 的 `CollectMODItem`，1 对应赛季上新，其余在排除 `superItemIds` 中的 7 个超级插件后对应季中上新。目前两组分别为 38 个、36 个。不得直接将所有已上线／未上线插件或所有 `season: s4` 条目算作上新。连锁电环、释能火环是补录旧插件，已移除误标的 S4 引入赛季，不属于这两组。未确认首次引入赛季时保持字段缺省，不猜测历史赛季。

跨赛季发布、历史保存和恢复统一使用 [插件与超限版本管理](../workflows/content-versions.md)。普通插件与超限共同归档，但不共享身份、投放状态或运行时数值。候选在独立工作区维护；归档不进入网站构建。

1. 更新 `refs/` 后先运行全量审计，不直接写入。
2. 身份、图标、适用武器和上线状态分别检查；确认真实上线日期后，在状态同步时显式传入 `--release-date`，避免一次批量同步混合多个风险面。
3. 描述差异按四类规则分类。
4. 小幅省略不改；严重残缺补全；真正冲突输出清单等待决策。
5. 用户确认或新截图证实后修改 MDX，必要时设置 `description_override: true`。
6. 运行 `git diff --check` 和 `pnpm build`。

详细命令和导入器字段说明见 [`.claude/commands/import-perks.md`](../../.claude/commands/import-perks.md)。

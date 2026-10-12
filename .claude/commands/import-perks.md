用户可提供一个或多个插件名称或 ID：$ARGUMENTS

目标：使用 `scripts/import-perks.ts` 从最新 `refs/` 审计并导入插件数据，解析适用武器，维护 `data/perks/slot-*/*.mdx`、PNG 源图和网站实际使用的 WebP 图标。

## 基本原则

- 先审计，后写入。不要一上来运行全量 `--write`。
- 已有非空 frontmatter 和 MDX 正文属于人工维护内容。普通 `--write` 不覆盖已有 `description`；描述只允许通过显式 `--sync-descriptions --write` 保守修复。
- 新插件先创建为 `draft: true`，检查名称、描述、数值、图标和适用武器后再发布。
- 适用范围分为三种：全部武器、标准武器类型、专属武器。分别使用 `weaponType` 和 `weaponNames` 表达，不能把专属武器误判为全部武器。
- 网站通过 `getAssetPath()` 将插件 `.png` 请求改写到 `/webp/icons/perks/*.webp`。只复制 PNG 会导致图片损坏，导入后必须生成对应 WebP。
- refs 中混有测试项、占位符、旧版和隐藏插件。默认只处理 `CollectMODItem=1` 的可收集插件；除非用户明确要求，不使用 `--include-hidden`。
- 字段漂移默认不自动修正。图标和适用武器只有在审计确认后，才分别使用 `--sync-icons`、`--sync-applicability` 显式同步。
- 插件正式名称优先使用 `CommonItemDataTable[MODItemID].Name.LocalizedString`，`WeaponModItemData.MODName` 只作为回退。两者不一致时，不得仅凭 `MODName` 将本地页面判为 orphan。
- 同一正式名同时存在旧隐藏条目和唯一 `CollectMODItem=1` 条目时，名称查询与身份核对应优先该唯一可收集条目；多个可收集候选才判为歧义并要求使用 `--ids`。
- ItemID 只认 `CommonItemDataTable` 行键/`ItemID` 与 `WeaponModItemData.MODItemID` 的同 ID 连接。`IconPath` 中的 MGE 编号和 `PassiveSkill_ID` 属于其他命名空间，可能复用或错位，禁止用它们反推 ItemID。
- 普通插件详情优先使用 `PassiveSkill_ID` 对应的完整 MGE 描述；MGE 缺失或仍含未解析 token 时，才回退到 `HuntingGroundRoguelikeWeaponModTable.OverrideDesc`，最后才使用 `AttrList` 属性拼接。Roguelike `OverrideDesc` 是玩法简写，不能覆盖完整详情。
- 用户提供游戏内插件详情截图时，先用多个已确认插件的完整句子反查共同原始表，再从同一张表读取目标插件。当前已确认武器插件详情正文来自 `DataTables/MGE/DT_GPMGESkillDesConfig_BD.json` 的 `MGEDescription`；不得因为目标同时存在猎场 `OverrideDesc` 就改用猎场简写。
- `OverrideDesc` 与 MGE 同时存在时必须比较数值。已有非空描述即使等于旧 Override 简写，也只报告差异，不自动升级；先人工分为“小幅省略”“严重缺失”“疑似旧版本”“真正冲突”，确认后再修改。数值冲突、未解析 token 或已确认的 MGE/Buff/Ability/蓝图跨表冲突会继续阻断自动写入。
- 人工确认并维护的描述可设置 `description_override: true`。导入器仍会审计来源，但任何描述同步都会跳过该文件。
- 字面意义的 refs 图标全量导入必须使用 `--all-with-icons`。该模式按 ItemID 判断本地缺失，仅选择实际 PNG 源存在的记录，并在写入前完成所有 MDX 和图标目标预检。

## Step 1: 审计范围

用户给了名称时，只审计这些插件：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --json
```

用户给的是 ID 时，改用 `--ids`，不要把数字当作名称位置参数：

```bash
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
```

用户没有给参数时，运行可收集插件全量审计：

```bash
pnpm exec tsx scripts/import-perks.ts
```

需要核对所有现有 MDX（包括当前隐藏插件）的描述时，使用：

```bash
pnpm exec tsx scripts/import-perks.ts --all --sync-descriptions --json
```

需要全量核对图标与适用武器时，分别使用：

```bash
pnpm exec tsx scripts/import-perks.ts --all --sync-icons --json
pnpm exec tsx scripts/import-perks.ts --all --sync-applicability --json
```

确认 `patchable` 只包含预期字段后，再增加 `--write`。`--sync-icons` 以同一 ItemID 的 `CommonItemDataTable.IconPath.NormalIcon` 为准，并校正本地 PNG；`--sync-applicability` 同步 `SuitableWeaponType` 和 `SuittableWeaponItem -> CommonItemDataTable.Name`。

需要导入 refs 中所有具有实际 PNG 图标源、但本地没有同 ItemID MDX 的插件时，先运行：

```bash
pnpm exec tsx scripts/import-perks.ts --all-with-icons --json
```

检查 `bulkImport.candidateCount` 和 `bulkImport.plans` 后写入：

```bash
pnpm exec tsx scripts/import-perks.ts --all-with-icons --write
```

此模式包括隐藏和旧版条目，固定写入 `season: pending`、`draft: true`。同槽同名条目全部使用 `标题-ItemID.mdx`；普通目标已被其他 ID 占用时也使用该稳定后缀。历史版本允许正式名称相同，`--all-with-icons` 对现有记录只按 ItemID 判断，不通过名称推断身份冲突；普通名称审计仍优先唯一可收集版本。同名历史版本后续也必须使用 ItemID 管理。该模式不能与名称/ID 选择器或任何 `--sync-*` 参数组合。

图标名保留资源 basename 中的完整数字后缀，例如 `1312068001_1`。目标 PNG 已存在时先比较内容；内容相同才复用，内容不同则使用附加 ItemID 的稳定名称，禁止覆盖或把不同源图合并到同一图标。

重点检查：

- `missing`：refs 中存在、本站尚未创建的插件
- `patchable`：已有页面中可以安全补齐的空字段
- `drifts`：必须人工判断的字段变化
- `descriptionAudit`：每个已匹配 MDX 的本地描述、MGE 描述、玩法覆盖描述、受支持 AttrList 描述、候选描述、分类、未解析 token 和来源冲突
- `descriptionSummary`：描述分类数量、来源冲突数量和可保守同步数量
- `unresolved`：描述中仍未解析的模板变量
- `local.orphan`：本站有页面，但最新 refs 无法按 ID 或名称匹配
- `local.hidden`：本站有页面，但最新 refs 未标记为可收集
- `identityWarnings.idConflicts`：本地非空 ID 与同名正式条目的 ItemID 不一致；禁止自动补字段或同步状态，必须先人工核对并修正 ID
- `identityWarnings.nameConflicts`：CommonItem 正式名称与 `MODName` 内部名不一致
- `identityWarnings.iconSkillMismatches`：图标资源号与 `PassiveSkill_ID` 不一致；这是告警而不是错误，分别按图标和效果链路使用
- `drifts.icon`：现有 `icon` 与同一 ItemID 的 CommonItem 图标不一致，可用 `--sync-icons` 修正
- `drifts.weaponType` / `drifts.weaponNames`：现有适用范围与解包字段不一致，可用 `--sync-applicability` 修正

`descriptionAudit.category` 的主要取值：

| 分类 | 含义 | 自动写入 |
|---|---|---|
| `match` | 本地描述与当前候选一致（忽略 Markdown 强调和标点） | 不需要 |
| `empty` | 本地描述为空，候选完整 | 允许 |
| `placeholder` | 本地含独立大写 `X` 或连续 `??` / `？？` | 允许 |
| `drift` | 本地已有具体文案，但与候选不同 | 只报告 |
| `source-conflict` | Override/MGE 数值签名不同、其中一条仍有 token，或命中已知运行时跨表冲突 | 禁止 |
| `unresolved` | 当前候选仍含 `{...}` 或占位符 | 禁止 |
| `missing-source` | Override 与 MGE 都没有可用描述 | 禁止 |
| `manual-override` | MDX 设置了 `description_override: true` | 禁止 |
| `identity-conflict` | 本地 ID 与正式同名条目冲突 | 禁止 |

候选描述优先使用 `PassiveSkill_ID -> MGE` 的完整文案；MGE 不完整时才回退到同一 ItemID 的 `HuntingGroundRoguelikeWeaponModTable.OverrideDesc`。`sourceConflict` 使用保守规则：两条来源的完整数值集合必须一致；一方省略数值也会报告冲突，交给人工判断。`knownConflict` 会给出已确认的数据质量或语义冲突；涉及 Buff、Ability 或蓝图的子集同时记录为 `runtimeConflict`。确认新冲突后应维护 `KNOWN_DESCRIPTION_CONFLICTS`，不能仅在 MDX 中临时绕过。

### 游戏内截图反查描述源

不要从单个目标插件的多个候选文案中猜哪条像游戏文案。正确流程是先用用户提供的其他已确认截图定位详情页实际读取的原始表，再在同一表中按技能 ID 查询目标：

1. 从至少两个已确认截图抄取有辨识度的完整短句，不只搜索插件名或单个数值。
2. 在 `refs/Exports/NZM/Content/` 中用 `rg --fixed-strings` 搜索短句，确认多个截图都落在同一描述表。
3. 使用 `CommonItemDataTable.ItemID -> WeaponModItemData.MODItemID -> PassiveSkill_ID` 建立目标插件链路。
4. 将 `PassiveSkill_ID` 的 `技能ID:等级` 转为 MGE 行键 `技能ID_等级`，读取同表 `MGEDescription`。
5. `DT_GPMGESkillDesConfigTable_Main.json` 是合并表，可用于导入器解析；需要判断游戏详情文案来源时，以截图反查命中的 `DT_GPMGESkillDesConfig_BD.json` 为证据锚点，并核对两表对应行。
6. `HuntingGroundRoguelikeWeaponModTable.OverrideDesc` 只表示猎场玩法卡片文案，可能严重缩写、使用旧数值或描述另一触发方式。除非用户明确要求复刻猎场卡片，否则不能用它覆盖插件详情页。
7. 截图用于确认玩家可见文案、触发条件和动态覆写证据，不能覆盖可直读的 Numerical 结构化字段。肾上腺素当前引用 `lc:120300310_1_0.coefficient`：每颗 `21%`、六颗 `126%`；旧截图或描述中的 `14%`、`84%` 只记录为冲突。

已确认可作为反查锚点的详情截图及 MGE 行键：

| 插件 | MGE 行键 |
|---|---|
| 异态共鸣 | `1315138001_1` |
| 相位强袭 | `1315145001_1` |
| 冥河送葬 | `1312053001_1` |
| 兽躯双衍 | `1312040001_1` |
| 幸运龙炎 | `1312032005_1` |
| 肾上腺素 | `1313031004_1` |

截至 2026-08-25 已审定的冲突项如下。MGE 行用于定位描述身份；最终数值仍按 Numerical 或其他结构化执行配置裁决：

| 插件 | MGE 行键 | 采用的详情描述要点 |
|---|---|---|
| 致命爆炸 | `1316200001_1` | 命中 `5%` 概率产生爆炸；冷却 `2` 秒；拒绝旧 MGE 的 `8%`、`5` 米和 `130%` |
| 武器穿透 | `1316201001_1` | 子弹穿透能力 `+2` |
| 导弹轰炸 | `1316210001_1` | 爆炸命中发射 `2` 枚；仅命中一个单位时发射 `5` 枚；冷却 `2` 秒；拒绝旧 MGE 的 `3` 枚 |
| 换弹冲击 | `1316211001_1` | 持续 `5` 秒；每秒冲击波；基础 `500%` 攻击力；每 `1%` 暴击率或换弹速度提高 `1%` 伤害 |
| 爆毒蚀域 | `1316213001_1` | 暴击投射毒液罐并生成减速毒域；冷却 `5` 秒 |
| 肾上腺素 | `1313031004_1` | `lc:120300310_1_0.coefficient` 每颗 `21%`，六颗 `126%`；拒绝旧文案的 `14%`、`84%` |

游戏描述中的 `<qiangdiao>...</>` 等强调标签统一转换为平衡的 `<strong>...</strong>`，不能机械替换为 `**...**`。CommonMark 会把 `有**40%**概率` 这类百分号后紧接中文的写法当作普通文本，导致页面显示原始星号。解析时同时移除 `U+200B` / `U+FEFF` 零宽字符；人工维护的 Markdown 强调仍由插件详情页兼容。

普通插件详情的冷却时间不使用 `（CD20秒）`、`(CD20)` 或 `CD20秒` 缩写。插件导入器统一转换为 `，冷却时间<strong>20</strong>秒`；编辑描述时保留 `<strong>20%</strong>` 这种数值强调格式。`data/overlimit-cards.json` 的超限卡片短摘要是独立展示面，可以保留 `（CD2秒）` 紧凑纯文本；维护规则见 `docs/standards/perk-data.md`。

已确认的描述 ID 错配只通过 `DESCRIPTION_ID_ALIASES` 显式修正。目前仅允许：

```text
PassiveSkill_ID 1316133001 -> MGE 描述 1312033001（穿甲扩散）
```

禁止按编号相似度、图标 ID 或相邻行推导其他别名。

### 异常分支 A：正式名称与 MODName 不一致

症状：`identityWarnings.nameConflicts` 出现记录，说明正式名称和策划内部名不一致。导入器应能直接按正式名称查询；内部名只在唯一命中时作为查询别名，重名时必须改用 `--ids`。

处理步骤：

1. 确认 `DataTables/System/Items/CommonItemDataTable.json` 的正式名称、行键和 `ItemID` 三者一致。
2. 使用同一个 ItemID 查询 `DataTables/LuaDataTable/WeaponModItemData.json`，核对 `MODItemID`、槽位和 `PassiveSkill_ID`；不通过图标号或技能号反查候选插件。
3. 正式标题采用 `CommonItemDataTable.Name.LocalizedString`；内部名、旧名或策划占位名只记录为诊断信息，不写入 `title`。
4. 名称查询出现多个候选时，改用 `--ids <ItemID>` 审计和写入；不得让脚本静默选择最后一项。
5. 描述继续按正常的 `PassiveSkill_ID -> MGE` 链路解析，不因为名称冲突改写数值。

如果 `identityWarnings.idConflicts` 非空，停止该文件的 `--write`、`--sync-status` 和其他自动补齐。先核对正式名称对应的 CommonItem ItemID，修正本地 `id` 后重新审计；不能因为旧 ID 非空就继续信任它。

已知同名版本案例：`技能增幅` 的旧隐藏 ID 为 `20703030003`，当前唯一可收集 ID 为 `20703040163`。按名称审计必须选择后者；本地仍绑定旧 ID 时应报告 `identityWarnings.idConflicts`。

已知案例：

```text
技能增涌
ItemID: 20703040184
CommonItemDataTable.Name: 技能增涌
WeaponModItemData.MODName: 导弹流_3
PassiveSkill_ID: 1315153001:1
IconPath MGE ID: 1315134001（与另一个插件的 PassiveSkill_ID 重合，不是 ItemID 外键）
最终描述: 武器技能伤害提升60%。
```

### 异常分支 B：纯 AttrList 插件

症状：插件有明确属性效果，但 `PassiveSkill_ID` 为空，MGE 描述链路无法生成 description。

处理步骤：

1. 读取 `WeaponModItemData.AttrList`，格式通常为 `属性ID:数值;属性ID:数值`。
2. 按属性 ID 查询 `DataTables/AttributeChannelDescriptionTable.json`，同时核对 `Attr_Id`、`Attr_Name` 和百分比模板。
3. 当前自动化只支持两个已确认比例属性：`104509` 弹匣容量、`104507` 换弹速度。
4. 比例值乘 100 并显示百分比；正值使用“提升”，负值取绝对值并使用“降低”。
5. 多个属性按原顺序合并；`AttrList` 只作为 `OverrideDesc` 和 MGE 都为空时的回退。
6. 出现任何其他属性 ID、格式异常或属性表定义变化时，整条 AttrList 不生成候选，并在 `attrWarnings` 中报告；不能只拼接已认识的部分。

已知案例：

```text
超载弹匣
ItemID: 20703040089
PassiveSkill_ID: 空
AttrList: 104509:0.55;104507:-0.03
104509: ClipAmmoAddRatio -> 弹匣容量提升55%
104507: WeaponChangeClipSpeedRatio -> 换弹速度降低3%
最终描述: 弹匣容量提升55%，换弹速度降低3%。
```

同一规则还覆盖：

```text
扩容核心 20703040161: 104509:0.24 -> 弹匣容量提升24%。
负压弹匣 20703040169: 104509:0.36;104507:-0.07 -> 弹匣容量提升36%，换弹速度降低7%。
```

当前已知且必须阻断自动同步的描述包括：伤害数值缺失、数值缺单位、持续时间未定、百分比与“发”单位混用、切枪语义冲突、负号易伤异常，以及 MGE 与 Buff 的持续时间/范围冲突。具体条目统一维护在 `KNOWN_DESCRIPTION_CONFLICTS`，以 `descriptionAudit.knownConflict` 为准。

## Step 2: 确认写入

有 `$ARGUMENTS` 时，可以直接处理用户指定范围。若没有参数且审计结果包含多项，不要擅自全量写入；先向用户说明数量和主要风险，确认导入范围。

明确范围和赛季后运行：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --write --season s2
```

按 ID 导入时：

```bash
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --write --season s2
```

未确定赛季时可以省略 `--season`，脚本会写为 `pending`，但发布前必须改成正确赛季。

普通 `--write` 行为仅包括：

- 创建缺失的 draft MDX
- 补齐已有 MDX 中为空的 `id`、`icon`、`weaponType`
- 从 refs 复制缺失图标到 `public/icons/perks/`

已有描述先运行审计：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --sync-descriptions --json
```

确认 `descriptionAudit` 后，显式写入：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --sync-descriptions --write
```

描述自动写入必须同时满足：

- 本地描述为空，或含独立大写 `X`，或含连续 `??` / `？？`
- 候选描述非空，且不含 `{...}`、`X`、连续问号
- `sourceConflict=false`
- `description_override` 不是 `true`
- ItemID 身份链没有冲突

本地已有具体数值或完整文案但发生漂移时，只出现在 `descriptionAudit`，脚本不会自动覆盖。人工确认后直接维护 MDX，并在确有长期人工差异时设置 `description_override: true`。

插件投放状态使用以下三个 frontmatter 字段。字段名保持与 refs 一致；后续新增或批量回填 MDX 时必须从同一条 `WeaponModItemData` 记录读取，不能手填猜测：

```yaml
CollectMODItem: 1
MakeMODItem: 1
IsCooked: true
```

| 字段 | 含义 | 页面用途 |
|---|---|---|
| `CollectMODItem` | `1` 表示进入插件展示、收集范围；`0` 表示投放关闭或隐藏 | 只有严格等于 `1` 才归入“已上线”，其余值或缺失字段归入“未上线” |
| `MakeMODItem` | `1` 表示允许进入插件制造范围；`0` 表示不可制造 | 不能单独作为是否上线的判断 |
| `IsCooked` | `true` 表示资源已参与客户端打包 | 只说明资源存在，不代表已经投放或可获得 |

`CollectMODItem=1` 只代表主插件展示/收集开关开启。若插件还需要进入特定玩法掉落池，继续检查对应玩法表；例如猎场肉鸽需要存在于 `HuntingGroundRoguelikeWeaponModTable` 且 `IsShow=true`，不能把两层开关混为一谈。

导入脚本会直接解析 `SuitableWeaponType`，并将 `SuittableWeaponItem` 中的武器 ItemID 连接到 `CommonItemDataTable.Name.LocalizedString`，自动写入 `weaponNames`。无法解析的武器 ItemID 必须出现在审计告警中，不能静默当作全部武器。

写入完成后立即转换插件图标：

```bash
pnpm exec tsx scripts/optimize-images.ts public/icons/perks
```

转换结果必须位于 `public/webp/icons/perks/{icon}.webp`。不要把 PNG 路径直接写进 frontmatter；`icon` 仍只写不带扩展名的图标 ID。

## Step 3: 解析适用武器

适用范围只从 refs 解析。

先在 `DataTables/LuaDataTable/WeaponModItemData.json` 中按插件 ID 找到完整行，读取：

- `SuitableWeaponType.Values`：标准武器类型 ID
- `SuitableWeaponTypeList.Values`：标准武器类型的备用字段
- `ExcludeWeaponType.Values`：排除的武器类型
- `SuittableWeaponItem.Values`：专属武器 ItemID（字段名在游戏表中就是这个拼写）

写入规则如下。

### 全部武器

以上限制字段均为空时：

```yaml
weaponType: []
weaponNames: []
```

通常省略空的 `weaponNames`，保留 `weaponType: []` 即可。

### 标准武器类型

标准类型写入 `weaponType: number[]`：

| ID | 武器类型 | ID | 武器类型 |
|---:|---|---:|---|
| 1 | 突击步枪 | 2 | 狙击步枪 |
| 3 | 霰弹枪 | 4 | 火箭发射器 |
| 5 | 冲锋枪 | 6 | 机枪 |
| 7 | 手枪 | 8 | 单发榴弹 |
| 9 | 激光武器 | 12 | 弓箭 |
| 13 | 近战武器 | 14 | 射手步枪 |
| 15 | 喷射器 | 16 | 连发榴弹 |
| 19 | 暗器 | | |

示例：`射手步枪/狙击步枪/霰弹枪/手枪`：

```yaml
weaponType: [14, 2, 3, 7]
```

### 专属武器

当 `SuittableWeaponItem.Values` 非空时，导入器会对每个 ItemID 查询：

```text
DataTables/System/Items/CommonItemDataTable.json
```

取对应行的 `Name.LocalizedString` 作为专属武器中文名，并写入 `weaponNames: string[]`：

```yaml
weaponType: []
weaponNames: ["飓风之龙"]
```

示例链路：

```text
WeaponModItemData[20703040429].SuittableWeaponItem = [20103000010]
CommonItemDataTable[20103000010].Name.LocalizedString = 飓风之龙
```

现有页面缺失或漂移时，先审计再运行：

```bash
pnpm exec tsx scripts/import-perks.ts --all --sync-applicability --write
```

必要时再到 `DataTables/LuaDataTable/WeaponItemConfigTable.json` 检查该 ItemID 的 `WeaponType`，并结合插件描述、对应武器 MDX 确认语义。

如果 `SuitableWeaponType.Values` 为空但 `SuitableWeaponTypeList.Values` 非空，使用后者。如果只有 `ExcludeWeaponType.Values`，根据项目支持的完整武器类型 ID 集合计算排除后的允许列表；不能可靠计算时不要猜，保留 draft 并报告。

refs 与本地非空值冲突时，先检查是否为版本变化；无法确认时不覆盖。ItemID 在 CommonItemDataTable 中没有名称、名称为空或无法对应现有武器时，保留 draft 并报告。

## Step 4: 人工复核

逐个检查新建和修改文件：

- `title`、`id`、`slot` 是否对应同一插件
- `rarity` 是否等于 CommonItemDataTable 的 `Quality - 1`
- `icon` 是否来自 CommonItemDataTable 的实际图标资源，而不是机械套用 PassiveSkill ID
- `id` 是否来自 CommonItemDataTable/WeaponModItemData 的同 ID 连接，而不是通过图标号、技能号或编号尾数推断
- `identityWarnings.idConflicts` 是否为空；非空时不得继续同步投放状态
- `public/webp/icons/perks/{icon}.webp` 是否存在且可正常读取
- `description` 中是否还有 `{...}`、`??`、测试文案或不符合当前版本的数值
- `CollectMODItem`、`MakeMODItem`、`IsCooked` 是否来自同一个 `WeaponModItemData` 条目，且没有把“已打包”误判为“已上线”
- 页面“已上线”状态是否严格满足 `CollectMODItem === 1`
- `weaponType` 是否只包含标准武器类型 ID
- `weaponNames` 是否只包含具体武器名称
- 只有 `weaponType` 和 `weaponNames` 都为空时，页面才会显示“全部武器类型”
- 专属插件是否已通过 `SuittableWeaponItem → CommonItemDataTable.Name` 链路解析，并结合对应武器页面确认
- `draft: true` 是否应继续保留

脚本无法解析的模板变量，按以下顺序查 refs：

1. `DataTables/MGE/DT_MGEParamConfig_Main.json`
2. `DataTables/MGE/MGEPassiveMainTable.json` 及其实际分表
3. `DataTables/Buff/BuffConfigDatatableNew.json`
4. 对应 Ability、MGE 蓝图 JSON 或生成的 C++

不知道就是不知道。无法确认的值保留 draft 并明确说明，不要猜。

## Step 5: 验证

再次对处理范围运行审计，确认不再出现在 `missing` 或 `patchable`：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS
```

确认对应 WebP 已生成：

```bash
Test-Path public/webp/icons/perks/{icon}.webp
```

检查适用武器字段：

```bash
rg -n "^weapon(Type|Names):" data/perks -g "*.mdx"
```

在插件详情页确认三种状态均能正确显示：

- 空限制 → `全部武器类型`
- `weaponType` → 中文类型和武器类型精灵图
- `weaponNames` → `专属武器`名称标签

其余验证按 `AGENTS.md` 的验证策略选择：修改导入器代码时对改动文件执行 ESLint；发布前运行 build，构建已经包含的检查无需再次列为前置步骤。跨赛季转正使用 `docs/workflows/content-versions.md` 的 `content-version promote` 入口。

# 增伤类型双向索引

> 状态：active  
> Schema：`data/guides/multiplier.json` V12，`data/modifier-providers.json` V1，`data/guides/multiplier-providers-runtime.json` V1

## 统一链路

站点用两条语义不同的链路生成双向查询：

```text
ItemID / CardID / 技能身份 -> 结构化证据 -> 增伤类型 -> 乘区 -> 页面落点
Settlement / 元素 / 许可标记 -> 伤害画像 -> 可用增伤类型 -> 乘区
武器 MDX 来源名 + Weapon Resolver 白值 -> 模式基础攻击力 -> 单次基础伤害
```

- `provider` 表示技能、插件、竞速卡片、超限卡片或羁绊提供某种增伤。
- `target` 表示原子伤害来源可以受到某种增伤影响。
- 插件以 ItemID 为稳定身份；同 ID 超限卡片由运行时自动展开第二个页面落点。
- 猎场竞速卡片以 CardID 为稳定身份，页面来源使用卡片 slug；只有 `CardID → Card_Function → MGE/Buff → GPModifier → Numerical AttributeName` 完整连通时才登记。
- 原点猎场强化以 RuneId 为稳定身份，索引来源为 `origin-rune:<RuneId>`；一级 Numerical 属性行按 RuneId 同编号段或直接 RuneId 查找，已核实的跨来源编号冲突使用精确 ModifierID 约束，再由语义 Resolver 派生分面。页面只展示有已索引分面的卡片，其余卡片登记排除项。此索引只确认属性归类，不推断蓝图的实际触发分支、叠层公式或受益对象。
- 原点武器词条以 AffixID 为稳定身份，索引来源为 `origin-affix:<AffixID>`。正式服没有 AffixID 到被动的映射表，`scripts/origin/project-affix-multipliers.ts` 按 `AffixWeaponAffixDisplayConfig` 与 `1378040xxx` 被动段的序列及名称审定映射，缺口逐项列明；其后与原点强化共用 `scripts/origin/passive-multiplier.ts` 的一级 Numerical 查找规则。无唯一被动的「元素附魔」与武器专属词条（10094 起）登记 `unverified-evidence`。
- 攻击等级覆写型卡片必须额外保存来源 MGE、覆写等级、攻击等级被动与下游 MGE；审计需确认该等级最终命中同等级 Numerical 行，不能把 `SetAttackLevelOverride` 当作证据链终点。
- `refs/` 只用于人工核验证据，构建和页面运行时不得读取。
- S0/S1 五条已确认分支按 Basic → 对应等级的 Passive → MGEConfig/MGE → Numerical 审核，不能直接以技能 ID 查同名 Config。`scripts/s0s1-season-talents/providers.ts` 从 `valueReview.applications` 和独立审计的 `provider-supplements.ts` 生成来源；后者核验 `audit.json.valueEvidence` 中机械威能三级各自的 Config 与 Modifier 身份，以 `unknown` 接收者登记全伤害属性，不推断运行时范围。未连通的节点登记 `unverified-evidence`，不据名称或描述 Token 推断乘区。当前数值不等同于历史实测值。
- S2 使用 `data/season-talents/s2/provider-evidence.json` 的历史证据快照，来源为 `refs/Exports/NZM/Content_S2`。三棵树的节点和被动逐项注册或明确排除；通过 Basic/Passive → MGE → Modifier 的结构化链，或维护者明确审核的天赋到 Modifier 映射登记来源。人工映射须记录审核依据，不能自动由描述模板推定，也不表示蓝图执行链已验证。各树使用自己的节点和被动身份，来源深链无需跨树归一。
- S2 来源的 `lc:` 仍表示猎场模式，但由来源的 `season: s2` 选择历史 Lock；投影、离线检查和审计统一通过 `scripts/num-modifier/provider-resolver.ts` 解析，缺失行报错，不回退当前 Lock。属性分类复用公共语义目录，历史证据内容哈希纳入投影新鲜度检查。
- S2 已连通 ModifierID 但缺少动态等级执行证据时，仅引用历史 Level 1 基准行识别增伤分面，不据天赋等级推定传入的 Numerical.Level，也不由索引发布实际增伤数值。蓝图默认属性的显式 Buff 引用、或成对的技能 ID 与 Buff 配置可以证明属性身份，接收者保持 `unknown`，不宣称实际加载对象与叠层已验证。当前纳入「火焰赋能」「技能强化」「谐波共振」「效能增幅」「群集算法」。
- S2 匿踪按维护者于 2026-09-12 确认的 Numerical 映射登记：「遁形」160303001、「暗影之刺I」160303005、「暗影之刺III」160303004、「暗影之刺II」160303006。前后两项由射击/爆炸伤害属性归入大稀释乘区，中间两项由暴击伤害属性归入暴伤乘区；命中弱点的触发条件不改变暗影之刺II的属性归属。数值仍读取历史 Numerical，接收者保持 `unknown`，不声称蓝图执行或叠层已验证。
- S2「强化射击」在三棵树分别登记被动入口，引用历史 `lc:111030011_1_0.coefficient`。该行 `BaseValue=0`、`CoefValue=0.003`，按每层系数识别正向武器增伤，归入大稀释乘区；不能用零基础值漏掉来源，也不因触发条件涉及元素异常归入元素乘区。
- S4 三棵树共 85 个节点、36 个光暗被动逐项登记，共 31 个乘区来源与 90 个明确排除项。每个节点只保存最高天赋等级的 Numerical 表达式，所有预览和配点等级使用同一来源身份；只有单一配置等级的 Modifier 保持自身固定等级。通用节点和被动在各树独立登记，深链不跨树归一。徽标不发布其他等级的数值。
- S4 索引维护入口为 `pnpm exec tsx scripts/project-s4-talent-index.ts --write`，不加 `--write` 时审计来源注册表。此命令读取正式服导出与脚本中明确记录的本地 Kismet 快照，检查最高等级 Basic/Passive、Buff、Modifier 默认属性和精确调用位置；不会刷新天赋描述或数值 Lock。随后执行 `pnpm sync`。常规构建与离线覆盖检查只读取已提交数据，不依赖本地参考库。
- S4 空间共振引用 `160401004_3_2.coefficient`，空间共鸣引用 `160401005_3_2.base`，扭曲瓦解引用 `111031067_3_0.base`，蓄能重击引用 `111053009_5_0.base`。巨构投影分别登记普通召唤物和火神变体的 `130040033`、`130040038` 伤害行，不把射速行作为乘区。双星与两类临时伴星的 B5 ExecutionRatio 只作为单次修正参数，不推导正向增量或最终因子。
- S4 猎场跃升由 `MetropolisPlayerAttackComponent.AddExtraAttackLevel` 动态调整攻击等级，没有固定的天赋 Numerical 表达式，以 `reviewed-override` 登记游戏模式分面，并记录 Native 实现未导出的边界；不借用商店某一级的数值充当天赋增伤值。金币、充能、持续时间、射速、范围等不属于伤害乘区；没有 Modifier 增伤的独立伤害事件单独排除。
- 维护者确认元素异常增伤归入大稀释乘区，火焰、腐蚀、寒冷、电弧分别登记属性通道。S2「炽焰倍增」引用 `lc:111030019_1_1.base`，`FireBuffPeriod` 不进入增伤索引。「爆发程序」「伤害增幅」「协同共鸣」分别使用 Modifier 111030002、111030003、111030006，前两者读取 base，协同共鸣读取 coefficient；持续时间和异常施加概率不作为增伤。「游龙」同步获得四种异常增伤分面。目标匹配仅在对应元素的异常结算下列为条件适用。

## 数据所有权

### S4 预览验收

`scripts/s4-perk-index-review.json` 保存初始 82 个 S4 插件的本地审定清单，包含旧条目冷焰爆破、冷焰续航。每项以 ItemID 连接本地 Passive、MGE、Buff 或字节码调用，来源使用精确 Numerical 表达式，排除项保留本地依据与未验证边界。`lib/s4-perk-index.test.ts` 校验注册表与清单一致，再通过预览 Resolver 验证派生分类和双向关系。

增伤来源必须直连本地预览 Numerical，不能用其他仓库的分类或描述维持 `reviewed-override`。无法核实的链路明确登记为 `unverified-evidence`，不能伪装成已验证的无增伤。纯属性的直连行保存在排除项的 `evidence.applications`，不作为伤害乘区来源。光暗冷焰按当前 MGE 的 `121400043`、`121400044` 分别登记爆炸和全伤害通道。驰射淬锋显示暴伤和大稀释两个徽标；图鉴中分居左右上角。同乘区的多个通道仍合并成一个徽标。

维护命令：`pnpm exec tsx scripts/project-s4-perk-index.ts --content-root <预载Content目录>` 默认只校验本地身份与已审定 Numerical 行；加 `--write` 才更新这 82 项注册，不覆盖其他插件、通道、MDX 或正式 Lock。数值漂移或缺行会报错，先复核并维护 `data/perk-preview-modifiers.json`，再重新运行。完成后执行 `pnpm num-modifier:project`；若技能索引已启用，再执行 `pnpm num-skills:project`。导入生成器会保留索引引用的预览行。

纯白之光（20703040540）使用本地 `1400090107_1_0.base`（WeaknessDamageRatio，B1，+70%），与其他来源一起在本地清单维护，不再使用测试或生成器中的 ItemID 分类例外。证据记录区分默认属性、实际调用、配置数值与描述语义；已解析行只证明对应属性，不自动证明作用对象、动态系数或全部执行分支。

本地复核后，这 82 项包含 37 个增伤来源和 45 个排除项。战灵余烬、矩阵湮灭、换弹引爆补入对应伤害事件的 Modifier，不视为全局增伤；寒霜之怒补入技能伤害通道。冷焰爆破、冷焰续航虽有蓝图写入的 ModifierID `121400016`、`121400017`，当前选定原表缺少对应行，因此保留 `unverified-evidence`，不能沿用旧分类或描述百分比。

S0「武器之歌」按维护者确认的 Buff 对应关系登记：`BD_Common_1318123001.GPModifyIDs=[119124001]`，以 `lc:119124001_1_0.base` 识别大稀释乘区的武器伤害分面。Buff 的 `_2` 至 `_5` 配置仍引用 119124001；不将 119124002～119124005 自动视为天赋后续等级。

S1 人工复核的精确技能 Token 映射由 `s1ReviewedApplications()` 登记：技能连击使用 `160201005_1_0.base`，侵蚀加深使用 `160201007_1_0.coefficient`，无我之境 I 使用 `160202007_1_0.coefficient`，灼眼天罚使用 `160202009_1_0.base`。仅以属性识别乘区，不推导叠层、历史等级或运行时接收者；灼眼天罚的 ExecutionCtx 使用伤害事件上下文。原始审计中的执行链缺口继续保留，不阻止上述人工审定的属性索引。

`data/guides/multiplier.json` 保存乘区和通道定义：

- `factors`：对外显示的规范乘区名。
- `baseDamage`：基础伤害公式及 LC/TD 模式基础攻击力；不保存武器白值副本。
- `damageChannelMatrix.channels`：索引分面和伤害类型适用规则；运行时导出为 `MODIFIER_TYPES`。属性字段由 Num Modifier 语义投影补充，不在矩阵复制。
- `factorDetails`：只保存规则、案例和提示等编辑内容；属性字段与元素选择标签由 Num Modifier 语义投影生成，禁止手写 `attributeFields`。
- 原有公式、规则、矩阵和案例说明继续作为乘区页面的编辑内容。

`data/modifier-providers.json` 是通用 Modifier 来源的唯一服务端注册表：

- `providers`：来源身份、Num 表达式、接收者上下文和结构化证据；直接来源不复制增伤类型。
- `exclusions`：非增伤候选及明确排除理由。
- 旧乘区案例只用于说明，不会被隐式转换为来源关系。
- 直接证据保存精确 `{ row, field, scale }`，按 `ItemID → PassiveSkill_ID → MGE GPModifier → resolveEffect() → facet → factor` 派生。
- 没有直连 Num 表达式的效果才使用 `reviewed-override`，并保留人工分面和完整机制依据。
- 竞速卡片禁止使用 `reviewed-override`；无法解析出伤害分面的表达式不进入乘区投影。
- `data/modifier-index-runtime.json` 是通用轻量投影；`data/guides/multiplier-providers-runtime.json` 从其中筛选伤害分面生成。客户端不导入完整 Lock。

原点强化的来源条目由 `pnpm origin-runes:multiplier:project` 从当前 `runes.json`、正式服 `MGEPassiveMainTable` 和已提交的 Num Lock 重建；原始 Numerical 表与 Lock 的一致性用 `pnpm num-modifier:audit` 核对。已核实的跨来源编号冲突使用精确 ModifierID 约束：「一击秒杀」保留 `130044210`，「极限单发」保留 `130045111`；「蓄势待发」保留 `130044380`，「直击榴弹」保留 `130044410`，「换弹增强」保留 `130045120`。「暴击飞弹」同编号段的 `130044311` 属于超限「暴力切换」，不登记增伤来源。`pnpm origin-runes:multiplier:check` 只审计，不写入。站点运行时与常规构建仍只读取已提交的来源及投影，不访问 `refs/`。来源数据更新后依次运行 `pnpm num-modifier:project` 和 `pnpm num-skills:project`。无同身份增伤行的卡片保留 `unverified-evidence`，不得按描述推定乘区。

原点词条的来源条目由 `pnpm origin-affixes:multiplier:project` 重建，`pnpm origin-affixes:multiplier:check` 只审计。两个脚本都读取 `MGEPassiveMainTable`，worktree 中用 `NZM_REFS` 指向主仓库的 `refs/`。同编号段的跨来源行用精确 ModifierID 约束：「毒皇·腐蚀」只保留 `130040030`（`130040031`～`130040039` 属 S5 返厂），「火神炎帝」只保留 `130040040`，霰化改装Ⅰ/Ⅱ 只保留 `130040340`、`130040350`。「攻击加成」四档的 `WeaponHit/ExplodeDamageRatio` 使用 B2，语义未建模，因此只由 B1 `DamageRatio` 归入游戏模式乘区。

超限卡片的具体增伤值不写入来源注册表。审定阶段可复用显式关联插件的 V2 `effect_values`，独立技能卡则登记自己的来源；最终结果保存到超限发布投影。两类数据职责如下：

- `modifier-providers.json` 决定“来源是谁、施加哪些表达式”，分类由语义 Resolver 派生。
- `effect_values` 决定“向玩家显示什么条件和数值”。条件语义可参考审定文案；凡能直连 Numerical 的值必须引用 Num Modifier V2 表达式，描述和人工文案覆盖不能覆盖结构化值。
- `lib/overlimit-cards.ts` 读取 `data/overlimit/current.json` 的已审定卡片投影，不再运行时合并插件 MDX。`data/overlimit/links.json` 是当前投影生成的轻量关联，退出卡池的卡片和未发布羁绊不生成超限链接；普通插件链接独立保留。原生技能卡可用 `source.type: overlimit-card` 登记自己的 Numerical 来源。
- 校验要求每个超限增伤来源与派生伤害分面精确匹配；未知分面、空阶段、重复语义和孤立效果都会报错。

武器目标关系不写回 MDX。`lib/multiplier-data.ts` 直接消费 Weapon Resolver 已有的 `settlements`、`element`、`enableCritical` 和 `enableWeakness`，为每个 `damageSources[]` 条目建立伤害画像。

武器白值索引同样不维护静态副本。`lib/weapon-base-damage.ts` 接收 LC/TD 的 `ResolvedWeapon[]`，只收录非近战武器中 `damage.base` 已解析的 MDX `damage_sources[]`；刺隐、夜影之逝等其他武器上的 `MeleeWeaponDamage` 来源继续保留。名称固定使用 `weapon.title + source.name`，白值和结算身份来自对应模式的 Resolver 投影，不读取 Lock `Description`。

`cadenceDisplay: "burst_timing_only"` 的来源只用于连发参数展示，不进入白值索引。即使 Resolver 保留了它继承的 `damage.base`，也不能据此生成独立伤害条目；其父伤害来源仍正常收录。

## 术语

徽标只显示规范乘区名，例如：

- 游戏模式乘区
- 攻击力增幅
- 大稀释乘区
- 元素乘区
- 易伤乘区
- 元素易伤乘区

`WeaponDamageRatio`、`WeaponHitDamageRatio`、`CloseRangeDamageRatio` 等只是大稀释乘区内的增伤类型，不得展示成“武器乘区”“武器通道乘区”或“近距离乘区”。同一伤害来源命中多个同乘区通道时，界面合并为一个乘区徽标，通道名只放在提示和精确筛选中。

`GPAttributeSetAttack.Attack` 的规范乘区名为“攻击力增幅”（内部 ID 保留 `independent-amplification`），只用于来源索引和来源徽标，不进入 Part 1 公式或伤害来源适用矩阵。普通商店的猎场攻击力归入“游戏模式乘区”，不得仅凭文案中的“攻击力”将其归入此项。

### 会心乘区

`super-critical` 显示为“会心乘区”，当前用于来源双向索引与徽标，不进入普通伤害公式。其来源通道 `super-critical-rate` 对应 `GPAttributeSetCritical.SuperCriticalRatio`，仍保留 `stat` 属性语义和“会心概率”名称；概率增量不能显示成伤害增幅，也不自动换算期望增伤。乘区矩阵显式登记该属性分面，预览生成器和超限关联投影据此纳入来源；其他暴击率、移动速度等未登记属性不因本次变更进入乘区索引。

S4 预览已核验四个来源：原生会心属性卡 `1317115001 / 1317116001 / 1317117001` 分别引用 `130015001_1_0 / 130016001_1_0 / 130017001_1_0`，以及瞬暴 8 件引用 `112041060_1_0`。四行均为 B1，会心概率分别增加 10/20/50/50 个百分点。金卡另有普通暴击率行，不能合并成会心概率。来源、数值与深链均按预览赛季隔离。

超限模式 28/29 经 `PlayerGameModeConfig.NumericalSettlementConstant=2`、`PlayerGameModeConstant.NumericalSettlementConstant_2` 选择 `NumericalSettlementConstantConfig_SuperRogue`，其 `SuperCriticalDamageRatio.Constant=2`。模式 26/27 的 Rogue 表同样为 2，不能声明会心机制只存在于超限。通用结算入口是 Native `NZNumericalStandardHitExecution`，现有导出未证明所有可暴击结算均允许会心；通道 `effects` 暂为空，不按 `enableCritical` 自动登记受益武器、召唤物或独立伤害。

`独弹强化` 当前使用精确行 `lc:111031014_1_0` 的临时实测语义：`BaseValue=6` 表示该次独头弹伤害按 `1 + 6 = 7` 倍独立结算，页面显示增量 `+600%`。它继续归入 `correction`“单次修正”，不归入上述 `independent-amplification`“攻击力增幅”；该结论不得推广到其他 `GPModifierOp=B2` 行。临时规则和失效条件见 [`../standards/num-modifier-semantics.md`](../standards/num-modifier-semantics.md#独弹强化-b2-临时规则)。

`DamageBearRatio` 的负值效果统一归入 `vulnerability`，显示名固定为“易伤乘区”；各单元素 `*DamageBearRatio` 与 `ElementDamageBearRatio` 的负值效果归入 `element-vulnerability`，显示名固定为“元素易伤乘区”。对应字段的正值是伤害减免，不进入增伤来源索引。旧 `factor=damage-reduction` 查询会兼容读取为 `vulnerability`。

## 运行时接口

`lib/multiplier-data.ts` 导出：

- `buildDamageProfile()`
- `getApplicableModifierTypes()`
- `getProviderRelationsForSource()`
- `getSourcesForModifierType()`
- `getRelationsByFactor()`
- `resolveMultiplierSourceHref()`
- `resolveMultiplierFactorHref()`
- `BASE_DAMAGE_DATA`

通用 Modifier 查询由 `lib/modifier-index.ts` 提供，可按来源、属性类型、方向、分面和接收者检索。

`lib/weapon-base-damage.ts` 导出：

- `buildWeaponBaseDamageIndex()`
- `WeaponBaseDamageEntry`

指南链接以查询参数保存状态：

```text
/guides?factor=dilution&view=providers&modifier=all-damage#multiplier
/guides?part=damage-sources#multiplier
```

`part`、`factor`、`view`、`modifier` 是可分享和可前进/后退恢复的权威状态；`factor` 表示当前 Part 的乘区状态。乘区公式和增伤索引分别保存自己的乘区选择，切换 Part 时恢复各自状态，不互相同步；元素易伤乘区只出现在增伤索引。`part=damage-sources` 打开同页 Part 2，不创建独立子路由。基础伤害索引额外使用 `mode=td` 表示塔防，缺少或非法 `mode` 时默认猎场。本地存储只作为没有查询参数时的乘区选择回退。

武器原子来源使用 `#damage-source-{sourceId}`。赛季节点和被动使用可分享 query 深链：

```text
/guides/season-talents/s3/grappling-hook?node=3003501#multiplier-provider-node-3003501
/guides/season-talents/s3/zero?passive=2030104#multiplier-provider-passive-2030104
```

通用节点只在 `zero` 注册一个规范来源；另外两棵树将页面节点 ID 归一为该来源后反查徽标。

无我之境 II、III、IV 通过 `s1ResonanceApplications()` 人工关联为共振获取来源，复用 I 的 `160202007_1_0.coefficient` 弱点分面，不增加独立增伤项。逐级核对实际 Passive 选择的 Config（II/III 的 StackCount、IV 的 Possibility），不使用同 ID 旧配置。共振 Buff 自身没有 GPModifyIDs；三项到共振的完整运行时施加链仍缺失，因此这属于共享状态的语义关联，接收者保持 unknown。

维护者明确提供的增幅协议 `111010122` 与裂解易伤 `111010161` 映射由 `s1MaintainerApplications()` 维护，分别归入全伤害与易伤。裂解易伤同步登记三棵 S1 树；仅对这三个节点允许独立人工映射绕过 `unrelated-charge-config` 的旧充能链排除，其他冲突仍阻止发布，旧链中的160202005不会进入索引。

蚀甲追猎（三棵 S1 树的1011602/1012602/1013602）作为虫群易伤的传播来源，语义关联到同一 `111010161_1_0.base`；不叠加另一份易伤、不把触发概率视作增伤。完整传播执行链仍未确认。

禁忌之瞳本体按重新核验的 MGE_1319022001 字节码登记 `160202003_1_0.coefficient` 弱点分面（offset810选择ID，offset883 scoped Modifier调用）；缺失DA入口及可选覆盖仍不作完整运行时结论。线路强化经维护者确认，使用 `111010170_1_0.base` 登记大稀释全伤害分面，仅补属性索引，不推导治疗或运行时范围。

## 校验

S2 证据维护：`pnpm exec tsx scripts/s2-season-talents/providers.ts --refresh` 从历史导出刷新证据，`--audit` 核对历史导出与快照；`pnpm project:s2-talents` 离线同步来源注册表并重建运行时投影。常规构建和页面均不访问历史导出目录。

```text
pnpm test:multiplier-data
pnpm test:overlimit-cards
pnpm overlimit-effects:audit
pnpm test:weapon-base-damage
pnpm multiplier-index:check
pnpm multiplier-providers:audit
pnpm num-modifier:check
pnpm test:s2-talents
```

测试覆盖基础伤害模式配置、全量白值索引、超限镜像、双乘区、Settlement 匹配和路由。`multiplier-index:check` 不依赖 `refs/`，验证所有发布插件、147 张卡片、武器技能和 S3 天赋均已映射或明确排除，并检查路由、镜像和双向一致性。`overlimit-effects:audit` 在存在 `refs/` 时重建身份链，但 Numerical 数值统一读取 Num Modifier Lock；`multiplier-providers:audit` 通过 Resolver 核对 ItemID、MGE token、表达式和已锁定属性描述。`num-modifier:check` 离线检查语义覆盖、来源引用和投影新鲜度，构建前固定执行。

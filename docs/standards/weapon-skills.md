# Num 技能协议

状态：active。实现：`lib/num-skill.ts`、`lib/num-skill-data.ts`、`lib/num-skill-index.ts`。

技能是 Num 协议的身份与参数层；武器 Numerical 继续拥有伤害，Num Modifier 继续拥有属性修改。技能替换是一条有方向的身份关系，不伪装成 Modifier 数值。普通构建与页面只读取提交快照，不访问游戏导出。

## 武器技能

121 份武器 MDX 显式声明 `skills`，无技能时为 `[]`。每项的 `id` 是武器内稳定身份，`kind`、`name`、`icon`、`tag` 是展示语义，`game_skill_id` 只在游戏身份已核实时填写。没有查明游戏 ID 的被动技能仍有本地身份，不按图标、名称或相邻编号猜 ID。

```yaml
skills:
  - id: active-1
    kind: active
    name: 浮游模式
    icon: /icons/weapons/skills/T_Weapon_Skill_20007000015_2.png
    game_skill_id: 5102001
    parameters:
      cooldown: { weapon_charge: time }
      count: { weapon_charge: count }
      duration: { runtime: "weapons:5102001:duration" }
```

正文只声明 `<ActiveSkill skill="active-1">…</ActiveSkill>` 或 `<PassiveSkill skill="passive-1">…</PassiveSkill>`，不重复传名称、图标、CD 等属性。说明正文保留在 MDX，模式专属 `GameMode` 内容不迁成跨模式副本。已知 ID 但原页没有主动卡的技能用 `display: false` 登记，不强加新卡。

`parameters` 支持 `cooldown`、`duration`、`count`、`blocking`、`panel_duration`。最后一项保持目录/属性面板与正文的展示开关分离，但二者可引用同一来源。`show_duration` 等可见性开关仍是武器页面语义。

## 参数来源

| 表达式 | 用途与校验 |
| --- | --- |
| `{ weapon_charge: time/count }` | 引用该武器已提交 Weapon Lock 的主动技能充能结果；技能 ID 必须一致。PVE 优先，缺行才 GP 回退。 |
| `{ runtime: "weapons:5102001:duration" }` | 引用 Num Skill Lock 中核验过实际读取点与使用点的持续时间绑定；技能身份、通道和用途必须匹配。 |
| `{ runtime: "weapons:5102001:duration", with_mge: 1312049001 }` | 显式选择该绑定已核验的 MGE 条件分支；未知条件报错，不推断装备状态，也不叠加猜测。 |
| `{ row, field }` | 引用 Num Skill Lock 中带通道的完整原始行；字段与参数种类、游戏技能身份必须匹配。 |
| `{ literal, reason, evidence }` | 尚无可直连配置的历史展示或有独立证据的值；必须保留具体依据，不能把迁移记录写成新实测。 |

GP `Duration` 是技能生命周期，不能一律代替效果持续时间。旧正文的 `duration: -1` 表示不展示，迁移显式保留；未知阻回不自动当作 false。旧站点阻回语义与 GP 激活生命周期不完全一致，未建立等价链路时保留原记录并注明证据，不机械覆盖。

MDX 按正式内容维护：正文直接说明机制，`reason` 简洁说明参数用途或采用依据，`evidence` 保留来源引用。核验状态、原生边界、候选配置和冲突过程记录在证据文档中，不在 MDX 重复“迁移前”“暂保留”“尚未核验”等维护措辞。措辞整理不改变来源等级；literal 仍是独立记录值，不能据此视为 runtime 绑定或实测结果。

### 已核验的持续时间绑定

`num-skill-lock.json.runtime` 按 `通道:游戏技能ID:duration` 保存来源与执行链，schema 位于 `lib/num-skill-runtime.ts`。每项必须包含来源、`flow.read`、`flow.apply` 的资产/函数/StatementIndex、JSON快照SHA-256、证据文档、Native边界和来源环境（未确认时为 `unknown`）。结构校验不能代替人工审查控制流，也不代表游戏内实测。

来源支持 `blueprint_default`（对象/字段/值）、`blueprint_constant`（函数/指令/值）以及核验过消费链的 `weapon_parameter`。后者复用 Weapon Lock 的值并核对被审计表的哈希；数据变化后必须重新审计，不能自动继承“已验证”结论。直接的 `{ weapon_parameter: ... }` 表达式已禁止，即使 Tag 正确或旧值恰好相等也不算生效证据。原来仅按字段名接入的时长已恢复为原值 literal，明确待核验。

条件修正保存 MGE ID、`add_fraction` 运算、系数及系数读取指令的证据。目前能源之影使用 `+基础值×0.5`。正文 `<SkillValue skill="active-1" field="duration" mge={1312049001} />` 调用同一解析器得到30秒，不允许在组件中手写倍率。基础页面仍显示裸枪值。已有技能替换 `skill_variants` 与条件修正是不同关系，保持独立。

执行 `pnpm exec tsx scripts/num-skills/audit-runtime.ts <manifest.json> [...manifest.json]` 可只读核验已登记蓝图默认值/常量、指令位置、条件系数和快照哈希。工具不刷新数值，也不自动证明控制流；PVE来源另需 Weapon Lock 哈希与消费者审计。普通构建只读取提交 Lock，不依赖本地证据文件。

`modifier_sources` 显式引用已有 Modifier provider ID；校验武器、技能名、组件种类与 provider 身份完全一致。已有 61 个 provider 及 104 个 exclusion 都参加覆盖审计。没有 provider 的技能不捏造 Numerical 数值；迁移目录不等于已审计其说明中的每个数字。

## 插件变体与版本

`data/num-skill-variants.json` 拥有稳定变体 key、channel、原游戏技能 ID、变体技能定义与证据。插件 `skill_variants` 声明 `weapon_slug`、`base_skill`、`variant`、`operation: replace`，插件不复制数值。拒绝原技能不存在、被动当主动、重复替换、同 ID 自替换和跨通道引用。

同技能 ID 的效果修改使用 `operation: modify`，目录和引用都须显式声明，不能伪造新技能ID。闪身、出其不意等通用替换使用 `{ scope: "all-weapons-active", variant, operation: "replace" }`，目录同样声明scope且不填原技能ID；索引保存一条通用边，按实际武器主动技能查询，不展开重复武器清单。普通伤害或射速强化不自动建成技能变体。

动态技能只展示基础持续时间时声明 `duration_is_base: true`，解析/冻结字段为 `durationIsBase`，详情数值加“起”。持续时间0表示无持续状态，详情显示“瞬时”，不代表动作动画耗时0。具体参数及动态覆写依据见[插件变体证据](../architecture/perk-skill-variant-evidence.md)。

Num Skill Lock 的 row key 为 `weapons|current|<season>-preview:gp|pve:<rowName>`。`weapons` 是现有武器目录的选定证据空间，不代表从最新游戏全表刷新正式数值。`current` 和预览通道互不回退。充能依旧引用原 Weapon Lock，不复制成第二份技能 CD 数据库。

预览插件发布时冻结解析结果及参数来源。运行时与索引读取已发布 `preview.json`，不读取尚未发布的预览 MDX，也不随当前武器或技能原表更新重算变体值。

## 双向索引

`data/num-skill-index.json` 是轻量投影，按武器、LC/TD、技能身份索引，保存插件替换边与 Modifier provider 关系，不保存输入文件哈希。校验时重新解析技能与变体并比较投影：仅当索引数据变化时要求重新生成，普通正文、无关武器字段和检出换行符变化不会使索引失效。正文中的技能引用与 provider 关系仍独立校验。技能参数的来源引用、原始游戏资产和 Lock 的证据哈希保留。查询入口：

- `getWeaponSkill(slug, mode, skillId)`；
- `getSkillVariantsForWeapon(slug, mode?, skillId?, channel?)`；
- `getSkillsForModifier(providerId)`。

草稿保留覆盖登记与 `draft` 标记；发布消费者应遵守草稿可见性。同一武器的 LC/TD 是两个明确入口，不能跨模式补缺失技能。

## 维护与验收

```text
pnpm num-skills:project
pnpm num-skills:check
pnpm test:num-skills
```

新增选定行使用 `pnpm exec tsx scripts/num-skills/lock.ts --channel <通道> --content-root <Content目录>`，只刷新该通道显式引用的行。CD 来源仍按 Weapon Lock 工作流维护。插件预览先 `pnpm perks:project --channel preview`，再生成技能索引。

`num-modifier:check`（dev/build 使用）包含技能索引校验。它检查全量技能声明、每个可见技能的唯一正文引用、Num 关系完整性和投影新鲜度。

首次迁移基线为 `data/weapon-skill-migration-baseline.json`，保存 121 份旧 header/body、SHA、两种模式有效参数。`scripts/num-skills/migration.test.ts` 从冻结的旧源码重新执行迁移，检查原始 SHA、header/body 可逆性、技能身份与全部有效参数；日常正文和无关 frontmatter 编辑不与历史文本比较。当前 MDX 单独检查技能姓名、图标、标签、持续、充能和层数，已审查参数变化由修正账本声明；组件引用及来源关联由技能投影校验覆盖。**历史迁移回放必须保持全部原 CD，能源之影固定验收 45 秒；迁移本身造成的任何 CD 变化均失败。** 新增武器由当前技能协议校验覆盖，不需要扩写历史迁移基线，也不能重新生成基线掩盖差异。

持续时间同样必须保持迁移前展示值，不允许把 PVE 同名参数与旧值的差异自动加入迁移白名单。字段名和 Tag 只能证明参数类型，不能证明技能逻辑实际消费它。新数值需要独立审计生效链路，不能以“存在于 Lock”代替验证。

### S4正式服与历史迁移回归

2026-09-22刷新正式包后，历史迁移与当前赛季分开验收。`scripts/num-skills/fixtures/pre-s4-migration-rows.json` 从提交 `7ee79b59b0193ee9c80c616e3ea2fc05acb84558` 的旧 Weapon Lock 摘录两行：炼狱蝎王 `skill-pve/5104101_1` 与樱之殇 `numerical-lc/lc:121300473_1`，保留原表来源哈希，并记录旧 Lock 完整SHA-256。测试仅在内存克隆中恢复这些行，以回放历史技能输出；这不是完整旧伤害数据集，不作为当前页面输入，也不依赖本地 refs 或运行时 Git。

`scripts/num-skills/s4-migration-review.ts` 独立记录本次变更：炼狱蝎王所选PVE行 `ChargeNeedTime` 曾从30变为40，现由当前修正账本恢复为30秒，LC/TD同步显示30秒；能源之影仍45秒。樱之殇轻击3的LC行缺失后仅保留TD来源；猪猪捏捏乐显式选择已核对的Prototype行。测试逐项核对历史变更与当前修正，冻结源码直接回放原始迁移；当前技能输出另与历史行解析结果叠加已审查变更和当前修正进行完整比较。原迁移基线不修改，后续未知参数变化仍失败。

## 持续时间冲突记录

- 能源之影：蓝图默认Duration20，经GetDuration读取，有超频MGE时变为30，写入AbilityDuration后交给Native结束逻辑；采用runtime引用。25秒PVE参数不是这条可见执行链的输入。CD仍为45秒。
- 天鹅之舞：蓝图FieldDuration12写入法阵ProjectileLifeSpan，超时回调清理MGE；正文与面板均采用runtime引用12秒。旧面板15→12是本次独立核验后的修正，不是PVE同名字段自动迁移。
- 心有凌兮：保留跳舞结束后的增益40秒，实际添加的XYLX_PassiveBuff_1配置仍为40；27秒没有可见生效链。Native添加内部未展开，保留带边界的literal。

完整身份链、函数位置、来源哈希与限制见[技能持续时间证据](../architecture/weapon-skill-duration-evidence.md)。

2026-10-12补充审计21把武器：密林杀机、幽冥毒王、收割者的正文与面板时长接入蓝图runtime绑定；其余18把保留literal并记录各自消费链、原生缺口与配置冲突。MDX来源说明不再使用“迁移前”作为核验依据。详见[持续时间补充审计](../architecture/weapon-skill-duration-followup.md)。

生命线主动伤害、喷发频率及黑克勒45手雷、强化异常与击杀回充的补录依据见[两把武器的技能数值证据](../architecture/weapon-skill-smx-ump-evidence.md)。独立伤害继续由武器 `damage_sources` 与 Weapon Lock 承载；蓝图回充值不伪装为基础 cooldown 或 Modifier。

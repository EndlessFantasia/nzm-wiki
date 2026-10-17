# 当前平衡调整证据

状态：active。2026-10-09 按本机正式服补丁 `4792691`、`4810509` 更新。本文记录当前站点采用的配置及展示冲突，不把公告数值或静态执行链当作实测结果。

## 武器插件与天赋

以下路径相对于 `refs/Exports/NZM/Content/`。武器、插件继续使用现有 V2 引用；刷新 Lock 后自动解析，不在正文复制新的伤害数值。

| 项目 | 结构化来源 | 采用变化 |
| --- | --- | --- |
| 极寒领域 | `DataTables/numerical_config_composite.json#120300174_1.HpCalScale` | 0.5 → 0.6，即攻击力的50% → 60% |
| 极寒领域爆炸增伤 | `numerical_modifier_config#120300175_1_0.BaseValue` | 0.5 → 0.7；原有生效链缺口仍保留，不新增增伤索引 |
| 极寒之触 | `numerical_modifier_config#120300171_1_0.CoefValue` | 每层0.1 → 0.15，三层30% → 45% |
| 贯长虹剑气 | `DataTables/numerical_config_composite.json#120300245_1.HpCalScale` | 13 → 9；基础伤害6500 → 4500，仅此LC行变化，TD行保持原配置 |
| 静默过载 | `numerical_modifier_config#130040036_1_0.BaseValue` | 每层0.07 → 0.09，六层42% → 54% |
| 巨构投影 | `numerical_modifier_config#130040033_1_0.BaseValue` | 0.6 → 1.5 |
| 光能补弹 | `MGEPassiveMainTable#1379040240_1.MGEConfig.Id=1379040241` → `MGEConfig_Season#1379040241.Parameters[GetSpecialAmmoRatio].Value` | 0.4，即40%；不能采用该类旧CDO默认的0.2 |
| 暗能过充 | `DataTables/numerical_config_playerskill.json#160405003_1..5.HpCalScale` | 全部等级3.2 → 6，即攻击力的320% → 600% |

两张 MGE 描述表的相关行已交叉核对。S4天赋只更新这四项对应的展示描述，保留既有“技能萃光”和“灵光先兆”的隐藏冷却说明。刷新整个天赋生成器时须单独保护这些人工补充。

## 原点强化卡

`data/origin/rune-descriptions.json` 与生成的 `runes.json` 更新33项展示文案，涵盖公告中的原点调整，以及补丁中“弱点迅环”的错字修正与跑酷卡变化；以按ID的实际差异为准，不按公告条目推断资产数量。

数值索引来自已刷新 Num Modifier Lock：怒战嗜血、坚盾增伤、玻璃大炮、血转环伤、独爆增伤、超级环、超级导弹、狂弹爆炸及超级落雷均采用精确 Numerical 行。秘技返还新增 `130042640_1_0`（WeaponDamageRatio）与 `130042640_1_1`（SkillDamageRatio），两行均为B1、BaseValue=1；坚盾增爆与暴击护盾新增MaxHealth属性行。属性名、operation与方向仍由统一Resolver派生，不根据展示描述覆写。

其他参数沿结构化执行配置核验，例如 `Buff_Rogue_1378042210.Duration=10`、`Buff_Rogue_1378042690.Duration=15`、`Buff_Rogue_1378042680.StackLimitCount=10`；强化秘技CDO `CooldownDuration=20`，射击雷击与冲击导弹/雷击冲击/导弹雷击的CDO `Probability` 分别为0.05/0.2/0.3/0.2，不动明王CDO `Start Time=1`、`Loop Time=1`。

### 怒战濒死冲突

公告、原点表及Buff展示描述写攻击力+300%，但身份链仍为：`MGEPassiveMainTable#1378042250_1` → `MGE_1378042250` → `Buff_Rogue_130042250.GPModifyIDs=[130042250]` → `lc:130042250_1_0`。Numerical的BaseValue=2、CoefValue=0、GPModifierOp=B5，未更新为3。

从补丁 `4792691` 选定 `.uasset/.uexp` 原地转换得到的 `ExecuteUbergraph_MGE_1378042250`，StatementIndex409以等级1、1层添加上述Buff；652的Delay为4秒，Buff.Duration也为4。可见链没有支持300%的动态覆写；Native内部未展开。文案采用Num模板得到200%，不推导B5的最终伤害因子。`data/origin/rune-description-reviews.json` 固定审定源文案与表达式，源文案变化会阻止自动沿用修正。

CD120秒暂沿用展示记录；CDO中的CooldownDuration=60尚未证明为实际生效冷却，不能直接替换。该冲突可复核输入为 `MD/_local/balance-20261009/MGE_1378042250.json`，不是游戏内实测。

## 超限快照边界

本次对当前177张超限卡的所有已审定 `selected` Numerical行逐项比较，未发现行内容变化；保持其独立发布快照。超限原表哈希审计仍因共享表与本地图标文件字节变化失败，不能把离线投影检查通过称为原表审计通过，也不能仅重写来源哈希掩盖证据漂移。后续超限更新应按现有审定与激活流程单独完成。

### 致命爆炸独立伤害补充

2026-10-09单独复核Item20703040437→Passive1316200001_1→MGE1316200001。当前CDO为Probability=0.05、CooldownDuration=0.1、AOEInterval=0.2；MGEConfig_Common、MGEConfig_Season及DT_MGEParamConfig_Main未找到该ID的参数覆写行。原表与选定执行资产哈希、单次结算原始行保存在 `scripts/overlimit/fatal-explosion-evidence.json`，不重写其他卡片的来源哈希。

本地 `.uasset/.uexp` 转换得到的 `ExecuteUbergraph_MGE_1316200001`：OnMakeDamage事件进入1115检查冷却，1226读取Probability，概率通过后跳至15，93调用CommitModularGameplayEffectCooldown，560调用DoNZAOEAction并传入AOE1316200001、Numerical130103014。AOE完成回调进入1270，经1324 Delay(AOEInterval)与1100 RetriggerAOE回到按StackCount处理的循环。0.2秒是堆叠爆炸重触发延迟，不能替代0.1秒配置冷却，也不能据此推导总爆炸频率。Native冷却和AOE内部未展开，未进行游戏内实测。

`NZAOEGlobalConfigTable#1316200001.AOERadius=800`，按UE厘米单位为8米。`numerical_config_composite#130103014_1` 为SkillDamage、HpCalScale=10、HpCalBase=0、ToughnessBase=10、Kinetic、允许暴击、禁止弱点，基础攻击力500时单次伤害为5000。纠正普通插件与触发伤害文章中的2秒、10米旧记录，将生成的独立伤害加入当前超限投影；卡片既有摘要与其他卡片内容保持原样。此补充不代表整份超限来源审计已通过。

复核与候选生成：

```powershell
pwsh -NoProfile -File .agents/skills/nzm-uasset/scripts/Convert-LocalAsset.ps1 -AssetPath refs/Exports/NZM/Content/Abilities/Build/CBT3/Perk02/MGE_1316200001.uasset -OutputPath MD/_local/nzm-uasset/fatal-explosion-20261009/MGE_1316200001.json -ReadScriptData
pnpm exec tsx scripts/overlimit/project-fatal-explosion.ts --content-root refs/Exports/NZM/Content --bytecode MD/_local/nzm-uasset/fatal-explosion-20261009/MGE_1316200001.json --output-directory MD/_local/overlimit/candidates/fatal-explosion-20261009
```

转换拒绝覆盖已有证据，复核时可直接使用已保存的JSON。候选先按超限维护流程check，再把生成的独立审定证据写到上述 `scripts/overlimit/` 路径，并用候选的 `review.json` 激活；执行资产或解析快照哈希改变时，生成器要求重新审定。

本项补充验证：独立伤害测试16/16、超限卡测试25/25、改动代码ESLint、TypeScript、超限投影与Weapon/Num Modifier数据检查均通过。测试中极寒领域的正式服旧预期同步为60%/300，保留冻结快照与覆写隔离检查。两次生产构建均在临时重命名 `app/api` 时遇到Windows文件占用（EPERM），尚未进入Next.js编译；路由目录完整保留，本项完整生产构建未验证。

## 射速目录补充核验（2026-10-17）

哈士奇鼓舞（20703040533）的射速使用 `lc:121600114_1_0.base`（B1，0.1），在增幅区域内为+10%。光暗死神（20703040551）使用 `lc:1410210103_1_0.base`（B1，0.05），光能量每层+5%，5层+25%；此效果替代死神猎手原满充能射速加成，不与其相加。

绝境雷霆（20703040570）的身份链已由 `perk:20703040570` 来源登记：Passive1312083001 → MGE1312083001 → 伤害Modifier120600190、射速Modifier120600191。当前正式Lock中两行均为B1、BaseValue=0、CoefValue=0.6、Level=1。旧描述的每1%弹耗+0.3%、上限21%没有跟随当前Numerical，改为表达式引用。

本次原地读取选定资产 `NZM/Content/Weapon/Data/Rifle/Rifle_20001000019_WBH_LT999P/MGE/MGE_1312083001_LT999P_DarkGoldPlugin.uasset`，保存快照 `kismet/unknown/20261017T050831Z-eaca7b280ad34a3d81fbaa4a06c62afb/json/NZM/Content/Weapon/Data/Rifle/Rifle_20001000019_WBH_LT999P/MGE/MGE_1312083001_LT999P_DarkGoldPlugin.uasset.json`，SHA-256为 `67f0fee8a83c6dfb03228d72403ffa0f9ca86eafc32e705602b30c9126340eb7`。来源环境与构建号未独立确认，按unknown保留；不将快照目录或导出日期视作正式版本证明。它与既有来源登记中的函数、Modifier及调用位置一致，数值仍采用已提交的正式Lock。

`ExecuteUbergraph_MGE_1312083001_LT999P_DarkGoldPlugin` 的伤害路径在549读取当前主弹匣弹量，606取最大主弹匣弹量，645相除，691计算 `1 - 当前弹量 / 最大弹量`，733将其Clamp至0–0.7，780把该输入传给120600190。射速路径从1292重置旧Modifier，经1414、1471、1510、1556重复同一计算，1598限制为0–0.7，1665把结果传给120600191，1833启动Action。射速初始化从3465保存1292执行路径；弹药变化回调亦更新该路径。2151的120600192为主动技能弹药消耗修正，未混入射速值。

因此发布表达式分别使用系数×0.01（每消耗1%主弹匣弹药，+0.6%）和系数×0.7（主弹匣剩余不高于30%，+42%），不是把0.6直接作为最大加成。Native Modifier内部与实际游戏运行未展开，本项为静态配置和蓝图输入审计，不是实测。

## 天赋、原点与射速上限补充（2026-10-17）

文章与目录区分普通射速加成、叠层合计、基础射速变化、射速上限和收益转换。`lib/fire-rate.ts` 的新增目录只通过Num Resolver解析正式Lock，不把展示描述写成数值来源，也不为尚未核定的上限或B5攻击转换推导最终因子。

| 来源 | 已核定数值与链路 |
| --- | --- |
| S4矩阵共生 | 节点4020102→Skill6005301；既有领域MGE1319051016的`OriginShootSpeedBuff=SeasonTalent_S5_XJHHHuge_RangeShootSpeed`，Buff.GPModifyIDs=[130040034]。玩家行`lc:130040034_1_1.base=0.09`、B1，为+9%；不使用同ID的召唤物间隔行`_1_0`。 |
| S4阵列共鸣 | 节点4020202→Passive1319053001；领域CDO的`TargetSumSpeedTalent=1319053001`、`TargetSumSpeedBuffName=SeasonTalent_S5_XJHHHuge_OwnShootSpeed`。Buff.GPModifyIDs=[130040035]、StackLimitCount=6、bMagnitudesFactorInStackCount=true；玩家行`lc:130040035_1_1.base=0.017`、B1，每层+1.7%，六层+10.2%。 |
| 怒战狂暴 | 强化1378042240→同ID被动与MGE；Buff_Rogue_1378042240.GPModifyIDs=[130042240]、StackLimitCount=20、按层数缩放。`lc:130042240_1_0.base=0.05`、B1，每层+5%，二十层截断前合计+100%，不视为最终生效射速。 |
| 狂战之力 | 强化1378044250→同ID被动与MGE；主图163将Modifier130044250施加于角色，玩家枪械行`lc:130044250_1_2.base=0.2`、B1，为+20%。同ID的近战行不并入枪械射速。 |
| 复合弓·备弹 | 词条10015沿现有审定映射→Passive1378040150；MGE主图30调用AddCrazyShootingEffect，参数为8秒、Modifier130040150。`lc:130040150_1_0.base=0.3`、B1，为+30%。 |
| 纯白·狂热 | 词条10006沿现有审定映射→Passive1378040060；主图99施加130040060，383向武器施加130040062，925添加Buff_Rogue_1378040060，1478换弹路径清Buff。CustomCD=1秒，857检查、989提交自定义冷却；Buff.GPModifyIDs=[130040061]、StackLimitCount=4、按层数缩放。`130040062_1_0.base=-0.2`为初始武器减益，`130040061_1_0.base=0.2`为每层增益；四层叠加部分+80%仍需扣初始减益。 |
| 纯白·狂热上限 | 同一130040060调用包含`lc:130040060_1_1`，属性`GunRPMRatioAdjustMaxAdd`、B1、BaseValue=0.3、CoefValue=0。按属性描述表2327确认其为射速上限，单独展示+30个百分点；在通常50%基准上只考虑此修正时算术上限为80%，不将其当作额外射速或推断多修正的叠加规则。 |

矩阵证据复用`kismet/live/20261013T110925Z-daa46394cacb44a7bb6bce9ccc96c9b9`中的`Abilities/Skills/Season/S5/XJHH/MGE/MGE_1319051016.uasset.json`及manifest：主图15120通过OriginShootSpeedBuff添加领域Buff；969检查TargetSumSpeedTalent，1472限制友方计数为6，2905用DeltaBuffStack添加TargetSumSpeedBuffName。原表路径虽含S5，站点S4身份由既有天赋表连接确认，不凭资产目录名推断赛季。

原点仅导出上述五个选定MGE，快照位于`kismet/unknown/20261017T051420Z-f413acbc1059427f9505097dfb47308b/json/NZM/Content/Abilities/Build/RoguePerk/S4/`。按既有正式服审计排除残留容器`P_1.0.50.485.0_Patch_Season_4261608_P.pak`；本次来源环境与构建号未独立确认，保留unknown，不把导出时间作为版本证明。快照SHA-256依次为：

| MGE | SHA-256 |
| --- | --- |
| 1378042240 | e1bed3e3b251aec1d16a3f019155b3d7ca6c44398d645600a1b96ba0cf375caa |
| 1378040060 | 80cd35a29a2318632b67550ebecde9c0788aedfde2827d7d6a91090727f74b7e |
| 1378040150 | 8088c1b8350e5ac91762803452cc164e0d5f50720f981e4fdfa0513cd3d5984d |
| 1378044250 | fdd6b3677ee957e8f77dd566f53ed22943d3b334f010bd2536f86e6db04a97f7 |
| 1378044500 | 466530eec9d6856817ba8681e3f69ac9fbb49a8bec812b41142d447a168a53bf |

怒战狂暴主图688添加上述叠层Buff，879监听0.1的累计血量与护盾损失。主图200另调用Modifier130042241，但当前正式Lock与本地Numerical原表均无该ID；不能用描述的“射速上限加50%”补造缺失行，也不能据二十层合计+100%断言实际翻倍。此上限例外保留待核验。

精准命中1378044500的主图724读取上限前的角色GunRPMRatioAdjust，893读取武器RPMAdjustRatio，计算后292将Scale×100作为334调用Modifier130044500的动态输入。该行是Attack、B5、BaseValue=0、CoefValue=0.014；B5最终因子未建模，因此文章只说明收益转换，不从1.4%的描述反推最终攻击力或额外射速。以上为配置与蓝图输入审计，Native内部和实际运行未展开，未新增游戏内实测结论。

## 平衡补丁同步验证

生产构建通过，生成1357个静态页面，构建临时隐藏的路由均已恢复。25项定向测试、25项超限卡测试、改动代码的ESLint、TypeScript及Numerical/原点/乘区索引投影检查通过。

扩大到武器与技能测试时发现两项测试仍依赖已停用的 `s4-preview` 通道，随后按用户要求删除这两项过期测试，保留模拟数据的通道隔离检查。重新运行 `pnpm test:num-skills`，143项全部通过；改动测试文件的ESLint通过。通道配置未修改。`multiplier-providers:audit` 仍报告极寒领域已有的生效链缺口（`perk:20703040537` / `120300175`）；保持排除记录，未将该审计标记为通过。`overlimit-effects:audit` 的来源哈希失败见上文。

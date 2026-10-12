# 生命线与黑克勒45技能数值证据

状态：active。对应 `data/weapons/生命线.mdx`、`data/weapons/黑克勒45.mdx`。本次只为这两把武器补齐显式伤害来源，不刷新其他武器或改变已有技能充能、持续时间参数。

## 来源边界

伤害引用读取正式服参考目录 `refs/Exports/NZM/Content/` 的 LC/TD 原表，按武器局部刷新到 Weapon Lock。新增行保存各自的原表路径和 SHA-256，未改变旧行及全局来源哈希。页面从已提交 Lock 解析，不读取本地参考库。

执行链复核使用 `kismet/unknown/20261012T051225Z-6fed5549574648e2aa928ee78f7a2f4b/manifest.json`，来源环境未独立确认，不将导出时间视作游戏版本，也不声称新增游戏内实测。以下资产路径均以 `NZM/Content/` 为根；StatementIndex 绑定本次快照。

| 资产 | 导出 JSON SHA-256 |
| --- | --- |
| `Abilities/WeaponSkill/Gold/TouchOfCold/BP_TouchOfCold.uasset` | `ee51f4dfb046446f55d326a3e45949ca849b6738ba678bf74d399ac7d1ee9599` |
| `Abilities/WeaponSkill/Gold/TouchOfCold/SKT_PulsedSpray4.uasset` | `abb07861b3871c9f89045a458402bb544189b2e47901e98b2187bb2393d76eca` |
| `Abilities/WeaponSkill/Purple/SunGrenade/BP_SunGrenade2.uasset` | `ea37388c74a3ef8a0bf614fdf729fae1c57e2c7edaa2450b48934712ef3d1116` |
| `Weapon/Data/SMG/SMG_20005000002_ZZ_UMP/MGE/MGE_1005004003_UMP.uasset` | `4f0ba9719a91bc5ec6deb26bb09369929489147152210165543c7caf16c0df4d` |

## 生命线：严寒之触

身份链：Prototype `20008000002` → 主动技能 `5100801` → GP 行的 `AbilityAssetSoftPath` 指向 `DA_TouchOfCold` → `AbilityBlueprint=SKT_TouchOfCold_C`；DA 的 `WinterActor` 指向 `BP_TouchOfCold_C`。

- `Default__BP_TouchOfCold_C.NamedThrowableSettlementConfig` 的 `Explode.NumericalID=1410080101`、`PulsedSpray.NumericalID=1410080102`。两者分别接入技能伤害来源，LC/TD 独立读取同 ID 的对应表行。
- LC/TD 原表中，冰冻爆炸 `HpCalScale=0.34`、`ElementAddRate=1`；冰雾 `HpCalScale=0.15`、`ElementAddRate=0.5`。正文不再手写 170、75、100%、50% 的副本。
- `BP_TouchOfCold.ExecuteUbergraph`：碰撞入口 4001、超时入口 4533 都跳到 3966；`Explode=false` 时到 3950 写入 true，再跳 614，阻止重复爆炸。614/619 压入后续执行流；服务器分支生成 `BP_PulsedSpray3`（1156），读取 `GetSettlementHandle("PulsedSpray")`（1206），写入生成对象的 `SettlementHandle`（1247），完成生成（1954）。执行流恢复到 1993 调用 `TriggerProjectileCustomEvent(CustomEvent)`，匹配自定义事件序列的 `Explode` 径向结算。
- `BP_PulsedSpray3.GPASC_Skill.StaticAbilities` 装配 `SKT_PulsedSpray4_C`。后者主图 30–125 从所属 `GPSkillSpawnableActor` 读取上述 handle，保存为 `OverrideSettlementHandle`，三条范围伤害任务均使用它。
- `TEMPLATE_SKT_PulsedSpray4_C_Begin_D4496549468D9D7DC30CFFA19BAD25BE.TimelineTaskContexts` 有三条非手动、无循环组的伤害任务：`AbilityTask_ApplyDamageByRange_0/1/2` 的 `m_StartTime` 分别为 3、6、9 秒；包装函数分别进入主图 2178、3739、5300。对应任务调用与激活路径成立，因此记录喷发间隔 3 秒、次数 3。Native 范围检测与实际命中仍受目标位置等条件影响，不将三次喷发写成必定命中三次。

冲突与保留项：GP `Description` 写“2s 后喷发一次”，与上述三条任务冲突，采用结构化时间线。旧 `NamedSettlementConfig.PulsedSpray` 仍有 `3745`，不把它替换成新协议的投掷结算 ID；采用 `NamedThrowableSettlementConfig` 的精确身份并记录 Native handle 选择内部未展开。时间线 `Length=9.96`、弹体生命周期与技能生效时长并非同一参数，不能据此直接覆盖旧面板 10 秒或 GP `Duration=0`；原技能时长 literal 保留原有“尚未核验”原因。

## 黑克勒45

### 燃烧手雷

Prototype `20005000002` → 技能 `5001001` → `DA_SunGrenade` → `SKT_SunGrenade_C`；DA 的弹体资源指向 `BP_SunGrenade2_C`。弹体 `NamedThrowableSettlementConfig.Explode.NumericalID=1400100101`，`AOEID=1600100101`；`NZAOEGlobalConfigTable[1600100101].AOERadius=600`，即 6 米。

LC/TD 对应 Numerical 行均为 `HpCalScale=0.36`、`ElementAddRate=1`，统一放入 `section: skill`。充能继续引用原 Weapon Lock 的 `5001001_1.ChargeNeedTime=50`，不保留正文手写伤害 180、异常概率 100%、CD 50 或由它们计算的 16% 回充副本。

### 强化灼热异常

普通射击 `120500020_1` 和手雷 `1400100101_1` 都声明火元素及 `ElementDebuffTypeID=1`；`ElementConfigDataTable.Fire.BuffNameType1=Fire_Special1`。猎场 Buff 原表 `Fire_Special1.NumericalID=90023`，周期和层持续时间均为 2 秒，`StackExpiration=RemoveSingleStackAndRefreshDuration`、`StackExpirationRemoveLevel=1`。其强化爆炸行 `Burning_Special1.NumericalID=90024`，免疫列表指向 `Fire_Special1`。元素状态施加和强化爆炸触发的 Native 内部未展开；沿用既有强化异常语义，仅替换它的手写数值来源。

LC 结构化伤害 `90023_1.HpCalScale=0.08`、`90024_1.HpCalScale=2.4`；分别接入“强化灼烧（每层）”和“强化元素爆炸”。对照普通行 `90021_1=0.02`、`90022_1=1.2`，灼烧系数为普通的 4 倍、爆炸系数为 2 倍，不能把两种结算都笼统写成 4 倍。Buff 描述中的旧百分比不覆盖 Numerical。

TD composite 表未提供 `90023_1`、`90024_1`，故两项只声明 `sources.lc`，不跨模式借用 LC 行，不将猎场强化异常数值发布成塔防结论。正文使用 `GameMode`，模式差异由 `WeaponModeDiff` 比较来源可用性。

### 击杀充能

MGE `1005004003` 的 CDO `DecreaseCDTime=8`。`K2_Initialize` 从主图 351 跳 203 注册伤害事件；回调 `OnMakeDamage_75EEBAA5496300A91157F39D487DF92A` 进入主图 10。52 检查事件冷却通过，125 检查 `Context.bIsDead=true`，148 获取角色，168 调用 `MGEActionChargeForSkillTimerVersion`，参数 2 读取 `DecreaseCDTime`；失败分支跳 356 返回。

8 秒来自蓝图默认值及实际读取点，不是 Numerical Modifier。现行 Num Skill 参数没有“击杀回充时间”字段，不能伪装成基础 cooldown 或构造 Modifier 引用；正文保留该机制值，以本段作为依据。Native 回充函数内部和伤害事件过滤位契约未展开，不据此扩大为任意来源击杀均可触发。

# 武器技能持续时间补充审计

本次核对 21 把武器、40 个 duration / panel_duration 声明。密林杀机、幽冥毒王和收割者接入已核验的蓝图默认值与实际使用点；其余 18 把仍保留 literal，并将原因与证据指向本页。去掉维护过程用语不代表消除核验缺口，也不代表实际游戏测试通过。

## 证据来源

正式服参考表位于 refs/Exports/NZM/Content；本次原地读取的游戏安装尚未确认环境，新增字节码快照标为 unknown。以下时间只代表导出时间，不代表构建号。未复制游戏容器，未改写已有参考数据。

- 技能 DA、蓝图与状态技能父类：`kismet/unknown/20261012T053133Z-b024dde9db184f2c9a8a0a292d80d6d5/manifest.json`。
- 对应 MGE 与法阵实例：`kismet/unknown/20261012T053327Z-860b218442794f19ac1d11537c3d5e4e/manifest.json`。
- MGE 状态技能父类、充能技能父类与法阵父类：`kismet/unknown/20261012T053403Z-cceb3b1fbf434e03995fd8a332427fd8/manifest.json`。

| 参考表（相对 NZM/Content） | SHA-256 |
| --- | --- |
| DataTables/GPActiveSkillDataTable.json | `11ebf9a96fa16d40e9f7897e355821e7380043774ceb5af0ec3d786e28fa3fe6` |
| DataTables/SkillConfigTable_Weapon_PVE.json | `768172e2f162503982fb7ac1d79c663a3085145ad9c8b268231078d841b6b747` |
| DataTables/MGE/GPModularGameplayEffectTable.json | `6ffe985668574ef868c4f4637ff01e3bcdb6357c425f46de961fa46fe22c29c3` |
| DataTables/Buff/BuffConfigDatatableNew.json | `6487653fb8ea58786761ab411d1f8bf7daf88e4a5314fd4da846524ff68f9670` |

每把武器的身份链从 MDX 的 active_skill_id 与 GPActiveSkillDataTable[ID].AbilityAssetSoftPath 出发，经 DA.Properties.AbilityBlueprint 定位蓝图。不能使用蓝图 CDO 的 SkillID 替代武器绑定：光荣之路、炼狱蝎王、玄凌飞刃、疾影逐风和黄沙风暴的 CDO 仍有其他技能 ID。表与字节码为两种证据来源，不能把 unknown 快照自动宣称为正式服完整实现。

## 状态技能的已见执行链与缺口

状态技能父类 `NZM/Content/Abilities/WeaponSkill/BaseBP/SK_StateSkillTemplate.uasset` 的 JSON SHA-256 为 `1ccf26f7da100dbea61dcb8a966fc24df3a0f3922667b924cd6743442af43666`。K2_ActivateAbility[0] 进入主图2326，2326→2311调用充能父类，2321→1782→1311；检查 OnlyOwnerWeaponUse 或当前持有武器，1505失败跳874结束。成功路径1519压入1563，服务端1558→889创建带 OwningAbility=self 和 OwnerWeapon 的 MGE Context（1019、1070），1125按 MGEIDGPRowName 施加 MGE。返回1563后，消耗方式分支可在54把 BuffDuration 写入 AbilityDuration，再跳15调用 Native DoDurationForEnd。

`NZM/Content/Abilities/WeaponSkill/BaseBP/MGE_StateSkillTemplate.uasset` 的 JSON SHA-256 为 `18ef10ded90b90139ca058295cf2a86b9459e7615bef0de72eaad65498afb93e`。K2_Initialize[0] 进入2212；从 MGE Context 中获得 OwningAbility 并转为 SK_StateSkillTemplate，1921读取 Ability.BuffName；1970→1470，1490将 Ability.SkillSlotType、Ability.BuffDuration 和 Ability.SkillID 传给 Native GetModifiedSkillDurationBySlotType。1682把返回值作为 AddBuffByName 的时长参数。Buff移除与死亡回调可触发清理、结束技能，持续时间并不保证技能不会提前中断。

此链确认了“时长计算返回值用于 Buff”，没有展开 Native GetModifiedSkillDurationBySlotType 的参数选择，也没有发现可证明 PVE Parameters 装载到 BuffDuration / FieldDuration 的蓝图实现。字段名、Tag和值相同均不能补足该缺口。因此不把以下 literal 批量换成 weapon_parameter runtime。CDO 的 BuffDuration=-1，以及元宵5/20、光荣15/10等冲突，也不能直接当作最终效果时长。

未闭环条目的 literal 来源仍是既有页面记录，原始记录可从提交 `b7ec722b` 的 `data/weapon-skill-migration-baseline.json#<武器>.active-1.duration|panel_duration` 复查；本页增加结构化候选配置与消费链，未把历史记录改称实测或已验证配置。

## Z型步枪

技能 5001601 → `NZM/Content/Abilities/WeaponSkill/Purple/TacticalLocking/DA_TacticalLocking.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/TacticalLocking/SK_TacticalLocking.uasset`。

蓝图 JSON SHA-256：`014a3b3b64243ee37c595cae885b3cb27484f913b3314d23edcc05e7a03f8b9f`。PVE `5001601_1.Parameters[Name=BuffDuration].Value` 为 10 秒；页面原记录为 10 秒。

CDO BuffName=`TacticalLocking_Time`，BuffDuration=10，SkillID=5001601，MGEIDGPRowName=500160101。BuffConfigDatatableNew[`TacticalLocking_Time`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=10；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 元宵来袭

技能 5002801 → `NZM/Content/Abilities/WeaponSkill/Purple/TangYuan/DA_TangYuan.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/TangYuan/SK_TangYuan.uasset`。

蓝图 JSON SHA-256：`b06de75bcebae20dfaf5371475b04de6bbb327247956f3ac7bddd00b5ec059b0`。PVE `5002801_1.Parameters[Name=BuffDuration].Value` 为 20 秒；页面原记录为 20 秒。

CDO BuffName=`TangYuan_Duration`，BuffDuration=5，SkillID=5002801，MGEIDGPRowName=1005012004。BuffConfigDatatableNew[`TangYuan_Duration`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=20；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 光荣之路

技能 5002501 → `NZM/Content/Abilities/WeaponSkill/Purple/GloryRoad/DA_GloryRoad.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/GloryRoad/SK_GloryRoad.uasset`。

蓝图 JSON SHA-256：`010e8c0691f110856e9ead06ada2a2c59e5e6de4de3f47af8dfea0431d794009`。PVE `5002501_1.Parameters[Name=BuffDuration].Value` 为 10 秒；页面原记录为 10 秒。

CDO BuffName=`GloryRoad`，BuffDuration=15，SkillID=5002101，MGEIDGPRowName=500250101。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=10；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 共晶点

技能 5001801 → `NZM/Content/Abilities/WeaponSkill/Purple/XJMActiveSkill/DA_XJMActiveSkill.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/XJMActiveSkill/SK_XJMActiveSkill.uasset`。

蓝图 JSON SHA-256：`442ab883f44f78b91175dcd2b9b35e66362d26d108f5f3b08e24f769d0cdb767`。PVE `5001801_1.Parameters[Name=BuffDuration].Value` 为 15 秒；页面原记录为 15 秒。

CDO BuffName=`XJMActiveSkill_Duration`，BuffDuration=继承父类-1，SkillID=5001801，MGEIDGPRowName=1005006501。BuffConfigDatatableNew[`XJMActiveSkill_Duration`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=15；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 密林杀机

技能 5000201 → `NZM/Content/Abilities/WeaponSkill/Purple/EnergyCracks/DA_EnergyCracks.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/EnergyCracks/SKT_EnergyCracks.uasset`。

蓝图 JSON SHA-256：`27a96e5427c9c9383c7ee142833a3dd278ddf8fec2c073720bdca47230bfc524`。PVE `5000201_1.Parameters[Name=FieldDuration].Value` 为 12 秒；页面原记录为 12 秒。

`Default__SKT_EnergyCracks_C.FieldDuration=12`。SKT主图2093生成 BP_EnergyCracks，2207把self写入 OwningAbility，2671完成生成。BP_EnergyCracks 的 ReceiveBeginPlay[0] 进入276，调用法阵父类后286→10；20将 OwningAbility 转为该技能类，85读取 FieldDuration 写入 Native ProjectileLifeSpan，248另将同值传给视觉效果。

法阵实例资产 `NZM/Content/Abilities/WeaponSkill/Purple/EnergyCracks/BP_EnergyCracks.uasset`，JSON SHA-256 `255f12af87017a1d399e668fe8e8f2e56cc75ec20011d45f8398221552587508`。法阵父类 BP_MagicArrayBase 的超时入口调用主图747的 Native K2_OnProjectileLifeTimeOut，757清理 MGE；父类 JSON SHA-256 `405a0217ab7c378f515cd5eee312fca2e055a7eebceda13ceb2fba3baf5fda0b`。

采用蓝图默认值12秒的 runtime 绑定，正文与面板均引用同一绑定。证据到达原生存活时间字段及超时清理回调；原生计时、动态覆写与PVE装载内部未展开，不声明此绑定来自PVE。

## 幽冥毒王

技能 5001301 → `NZM/Content/Abilities/WeaponSkill/Purple/ChargingArray/DA_ChargingArray.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/ChargingArray/SKT_ChargingArray.uasset`。

蓝图 JSON SHA-256：`14ec779097e456b9718067c1bf8d1182bbcac2457c1066353ff92b66281d44eb`。PVE `5001301_1.Parameters[Name=FieldDuration].Value` 为 12 秒；页面原记录为 12 秒。

`Default__SKT_ChargingArray_C.FieldDuration=12`。SKT主图2093生成 BP_ChargingArray，2207把self写入 OwningAbility，2671完成生成。BP_ChargingArray 的 ReceiveBeginPlay[0] 进入276，调用法阵父类后286→10；20将 OwningAbility 转为该技能类，85读取 FieldDuration 写入 Native ProjectileLifeSpan，248另将同值传给视觉效果。

法阵实例资产 `NZM/Content/Abilities/WeaponSkill/Purple/ChargingArray/BP_ChargingArray.uasset`，JSON SHA-256 `80f5ca579468f9212ffee85e888192e8eeede952dc8746481d2754a37cf9822e`。法阵父类 BP_MagicArrayBase 的超时入口调用主图747的 Native K2_OnProjectileLifeTimeOut，757清理 MGE；父类 JSON SHA-256 `405a0217ab7c378f515cd5eee312fca2e055a7eebceda13ceb2fba3baf5fda0b`。

采用蓝图默认值12秒的 runtime 绑定，正文与面板均引用同一绑定。证据到达原生存活时间字段及超时清理回调；原生计时、动态覆写与PVE装载内部未展开，不声明此绑定来自PVE。

## 收割者

技能 5000701 → `NZM/Content/Abilities/WeaponSkill/Purple/ExpandLoading/DA_ExpandLoading.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/ExpandLoading/SKT_ExpandLoading.uasset`。

蓝图 JSON SHA-256：`aa5bdf6bfd8db821742c140249b079a741565cc9b837570f101f9852a8863db0`。PVE `5000701_1.Parameters[Name=BuffDuration].Value` 为 10 秒；页面原记录为 10 秒。

`Default__SKT_ExpandLoading_C.BuffDuration=10`。K2_ActivateAbility[0]进入主图860，先调用充能技能父类；870→993检查当前武器类型，1024在类型不等于13时跳1057，读取 BuffDuration 写入 AbilityDuration，1084调用 Native DoDurationForEnd；类型等于13的分支1038直接结束。服务器检查1117通过后1210把同一 BuffDuration 作为 AddBuffByName(ExpandLoading_Duration) 的时长参数，1297保存句柄；非服务器转1658处理展示。技能结束分支会移除Buff与MGE，不能把自然持续时间等同于保证存活时间。

采用蓝图默认值10秒的 runtime 绑定，正文与面板均引用同一绑定。原生 Buff / 结束计时与PVE装载内部未展开，不声明此绑定来自PVE。

## 梦魇

技能 5000903 → `NZM/Content/Abilities/WeaponSkill/Purple/RockBody3/DA_RockBody3.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/RockBody3/SK_RockBody3.uasset`。

蓝图 JSON SHA-256：`6e51559912f5f42e6723c5621b0ac8a66da8cbff62b7cee235fd80c9b277b12d`。PVE `5000903_1.Parameters[Name=BuffDuration].Value` 为 30 秒；页面原记录为 30 秒。

CDO BuffName=`RockBody_BearRatio3`，BuffDuration=继承父类-1，SkillID=5000903，MGEIDGPRowName=500090301。BuffConfigDatatableNew[`RockBody_BearRatio3`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=30；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 沙丘之怒

技能 5001701 → `NZM/Content/Abilities/WeaponSkill/Purple/SQZNActiveSkill/DA_SQZNActiveSkill.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/SQZNActiveSkill/SK_SQZNActiveSkill.uasset`。

蓝图 JSON SHA-256：`e5b624aacf8627bfe144ff87f11dea81feca40d53cde32a6db0ea5e88bd61d0b`。PVE `5001701_1.Parameters[Name=BuffDuration].Value` 为 12 秒；页面原记录为 12 秒。

CDO BuffName=`SQZNActiveSkill_Duration`，BuffDuration=继承父类-1，SkillID=5001701，MGEIDGPRowName=1004014501。BuffConfigDatatableNew[`SQZNActiveSkill_Duration`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=12；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 炼狱蝎王

技能 5104101 → `NZM/Content/Abilities/WeaponSkill/Gold/WanderMode/DA_WanderMode.uasset` → `NZM/Content/Abilities/WeaponSkill/Gold/WanderMode/SK_WanderMode.uasset`。

蓝图 JSON SHA-256：`3eb5f16d1ed5e8cdf1d11f2ae7720ace0d9557bea2f7dfe6771a6fbccab0eca1`。PVE `5104101_1.Parameters[Name=BuffDuration].Value` 为 12 秒；页面原记录为 12 秒。

CDO BuffName=`Weapon_20005000034_2`，BuffDuration=继承父类-1，SkillID=5000902，MGEIDGPRowName=1005034002。BuffConfigDatatableNew[`Weapon_20005000034_2`].Duration=12。

MGE_1005034002_LYXW主图743从OwningAbility转出的状态技能读取 SkillSlotType、BuffDuration，调用 GetModifiedSkillDurationBySlotType；847将返回值写入BuffDur，895把BuffDur作为AddBuffByName(Weapon_20005000034_2)的时长参数。1040另有把BuffDur设为-1的分支。该MGE继承BP_MGE_Normal_Base，不套用MGE_StateSkillTemplate的初始化路径。Buff配置12秒与PVE12秒一致，Native取值及负值分支的最终时长选择仍未展开。

当前保持 literal=12；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 玄凌飞刃

技能 5102801 → `NZM/Content/Abilities/WeaponSkill/Gold/DeadlyLink/DA_DeadlyLink.uasset` → `NZM/Content/Abilities/WeaponSkill/Gold/DeadlyLink/SK_DeadlyLink.uasset`。

蓝图 JSON SHA-256：`3a70ab6cb194355e0a54380bd21f24469005e94a1984ae84ccbb0670943efb7f`。PVE `5102801_1.Parameters[Name=BuffDuration].Value` 为 12 秒；页面原记录为 10 秒。

CDO BuffName=`Kuwu_bootst`，BuffDuration=继承父类-1，SkillID=5000902，MGEIDGPRowName=1019010001。BuffConfigDatatableNew[`Kuwu_bootst`].Duration=12。

SK_DeadlyLink.K2_ActivateAbility[0]进入主图10，先调用状态技能父类；40读取SkillSlotType、BuffDuration调用Native GetModifiedSkillDurationBySlotType，120将返回值作为AddBuffByName(Kuwu_bootst)的时长参数。PVE和Buff均为12秒，与页面10秒冲突；原生计算如何处理继承的-1尚未确认，保留10秒并记录冲突，不把12秒伪装为实测结论。

当前保持 literal=10；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 疾影逐风

技能 5103301 → `NZM/Content/Abilities/WeaponSkill/Gold/SlidingTime/DA_SlidingTime.uasset` → `NZM/Content/Abilities/WeaponSkill/Gold/SlidingTime/SK_SlidingTime.uasset`。

蓝图 JSON SHA-256：`e8dd28b901f9a7291d24b03aa57c1cdff430a815786235fd9cb301a7344be783`。PVE `5103301_1.Parameters[Name=BuffDuration].Value` 为 12 秒；页面原记录为 12 秒。

CDO BuffName=`Weapon_20003000031_1`，BuffDuration=继承父类-1，SkillID=5000902，MGEIDGPRowName=1003031003。BuffConfigDatatableNew[`Weapon_20003000031_1`].Duration=12。

状态技能仍通过继承的K2_ActivateAbility创建MGE Context；SK_SlidingTime覆盖结束事件，主图254调用状态技能父类结束函数，服务端52→166检查滑铲状态，必要时227移除MGE1003031003。该MGE继承BP_MGE_Normal_Base，不套用MGE_StateSkillTemplate的初始化路径。Buff配置12秒与PVE12秒一致，Buff施加与结束时长选择仍有原生边界。

当前保持 literal=12；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 纯白至上

技能 5000902 → `NZM/Content/Abilities/WeaponSkill/Purple/StoneBody/DA_StoneBody2.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/StoneBody/SK_StoneBody.uasset`。

蓝图 JSON SHA-256：`2663a3ad6cce545810f5851872d2f7c75afeb66c39c6be1c825ee12374b57c62`。PVE `5000902_1.Parameters[Name=BuffDuration].Value` 为 15 秒；页面原记录为 15 秒。

CDO BuffName=`StoneBody_BearRatio`，BuffDuration=继承父类-1，SkillID=5000902，MGEIDGPRowName=500090102。BuffConfigDatatableNew[`StoneBody_BearRatio`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=15；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 维和者

技能 5000101 → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting/DA_CrazyShooting.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting/SK_CrazyShooting.uasset`。

蓝图 JSON SHA-256：`441c6050ffa1c393be849c0a30247342fb6cb5bda0f662dfc1b93a6d5f099880`。PVE `5000101_1.Parameters[Name=BuffDuration].Value` 为 8 秒；页面原记录为 8 秒。

CDO BuffName=`CrazyShooting_Time`，BuffDuration=继承父类-1，SkillID=5000101，MGEIDGPRowName=500010101。BuffConfigDatatableNew[`CrazyShooting_Time`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=8；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 裁决之眼

技能 5002101 → `NZM/Content/Abilities/WeaponSkill/Purple/CriticalMode/DA_CriticalMode.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/CriticalMode/SK_CriticalMode.uasset`。

蓝图 JSON SHA-256：`2ddc3a906c3e4d26e6e2f51768a917366dc44301aeaaf7248db1740eb9ea0dfb`。PVE `5002101_1.Parameters[Name=BuffDuration].Value` 为 15 秒；页面原记录为 15 秒。

CDO BuffName=`Weapon_20002000002_1`，BuffDuration=15，SkillID=5002101，MGEIDGPRowName=500020201。BuffConfigDatatableNew[`Weapon_20002000002_1`].Duration=15。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=15；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 超级复合弓

技能 5000102 → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting_CJFHG/DA_CrazyShooting_CJFHG.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting_CJFHG/SK_CrazyShooting_CJFHG.uasset`。

蓝图 JSON SHA-256：`2e3875a410230e43bb336e526f04130360705e79c5a0f65ab98c591e39b9bd4b`。PVE `5000102_1.Parameters[Name=BuffDuration].Value` 为 8 秒；页面原记录为 8 秒。

CDO BuffName=`CrazyShooting_Time`，BuffDuration=继承父类-1，SkillID=5000102，MGEIDGPRowName=500010101。BuffConfigDatatableNew[`CrazyShooting_Time`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=8；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 钢铁游隼

技能 5002301 → `NZM/Content/Abilities/WeaponSkill/Purple/FalconStrike/DA_FalconStrike.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/FalconStrike/SK_FalconStrike.uasset`。

蓝图 JSON SHA-256：`97b436569402cb0dde0ddfb3a31a12c6f8eec6ceab6e8fb6b4c86ff5ad3deada`。PVE `5002301_1.Parameters[Name=BuffDuration].Value` 为 10 秒；页面原记录为 10 秒。

CDO BuffName=`FalconStrike`，BuffDuration=10，SkillID=5002301，MGEIDGPRowName=500230101。BuffConfigDatatableNew[`FalconStrike`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；SK_FalconStrike主图72显式调用状态技能父类K2_ActivateAbility；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=10；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 雷霆999

技能 5000301 → `NZM/Content/Abilities/WeaponSkill/Purple/LightningChain/DA_LightningChain.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/LightningChain/SK_LightningChain.uasset`。

蓝图 JSON SHA-256：`a2586da4e8bb2b4d409b908421e94f255d4aabe0534d7420ae0ccfff6623add7`。PVE `5000301_1.Parameters[Name=BuffDuration].Value` 为 15 秒；页面原记录为 15 秒。

CDO BuffName=`LightningChain_Duration`，BuffDuration=继承父类-1，SkillID=5000301，MGEIDGPRowName=500030101。BuffConfigDatatableNew[`LightningChain_Duration`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=15；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 雷霆之影

技能 5000901 → `NZM/Content/Abilities/WeaponSkill/Purple/RockBody/DA_RockBody2.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/RockBody/SK_RockBody.uasset`。

蓝图 JSON SHA-256：`d27054f3724159f295f75aa925a39ca20c38d213c412eb141add8553a3359271`。PVE `5000901_1.Parameters[Name=BuffDuration].Value` 为 10 秒；页面原记录为 10 秒。

CDO BuffName=`RockBody_BearRatio`，BuffDuration=继承父类-1，SkillID=5000901，MGEIDGPRowName=500090101。BuffConfigDatatableNew[`RockBody_BearRatio`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=10；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 黄沙风暴

技能 5000103 → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting_HSFB/DA_CrazyShooting_HSFB.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/CrazyShooting_HSFB/SK_CrazyShooting_HSFB.uasset`。

蓝图 JSON SHA-256：`29500c68c6ad98e86bdc3a8da541d10d4478cc95af314a4c4282de4c94f0320e`。PVE `5000103_1.Parameters[Name=BuffDuration].Value` 为 8 秒；页面原记录为 8 秒。

CDO BuffName=`CrazyShooting_Time_HSFB`，BuffDuration=继承父类-1，SkillID=5000101，MGEIDGPRowName=500010101。BuffConfigDatatableNew[`CrazyShooting_Time_HSFB`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=8；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 黎明之光

技能 5003001 → `NZM/Content/Abilities/WeaponSkill/Purple/DoubleBullet/DA_DoubleBullet.uasset` → `NZM/Content/Abilities/WeaponSkill/Purple/DoubleBullet/SK_DoubleBullet.uasset`。

蓝图 JSON SHA-256：`ffe1a01b6557157767b05adeca0991ae9d5343cb5f1acfda24faeada51f4caf1`。PVE `5003001_1.Parameters[Name=BuffDuration].Value` 为 15 秒；页面原记录为 15 秒。

CDO BuffName=`Weapon_20005000001_1`，BuffDuration=15，SkillID=5003001，MGEIDGPRowName=500280101。BuffConfigDatatableNew[`Weapon_20005000001_1`].Duration=-1。

其MGE沿已核对的MGE表与对应资产继承MGE_StateSkillTemplate；使用本页所列1490→1682的计算/施加链。配置中的时长与最终返回值之间仍隔着未展开的原生实现。

当前保持 literal=15；待确认原生时长选择或取得可重复的运行时日志后，再接入对应配置来源。不能通过本次备注清理认定该条已完成数值核验。

## 复核

使用 `pnpm exec tsx scripts/num-skills/audit-runtime.ts`，传入现有能源之影/天鹅之舞绑定的20260921T220434Z快照，以及本页前两个快照，可校验所有runtime绑定的默认值、读取指令、使用指令与哈希。该命令不证明控制流，控制流与Native边界须按上述记录复核。PVE/GP/MGE/Buff候选表保持只读，不修改Weapon Lock，也不改CD。

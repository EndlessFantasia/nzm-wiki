# 触发类伤害审计

状态：active。2026-11-11 对 `refs/Exports/NZM/Content` 的现有正式服导出进行维护，不将本次审计日期当作客户端更新日期。汇总入口为 `lib/trigger-damage.ts`，正文为 `data/posts/trigger-damage.mdx`；超限详情仍只读取 `data/overlimit/current.json` 的独立发布快照。

## 覆盖与数值

本次覆盖 101 条记录、111 个不同 Numerical 行：17 项已上线普通插件、14 项超限卡、2 项当前羁绊、15 项未上线普通插件、21 项旧原型、31 项其他来源或未归属配置，以及 1 项历史核爆。烈焰冲击在普通插件分组，通过明确卡片 ID 同时发布至超限；因此超限快照共有 15 个卡片 ID。

全部配置值从 `DataTables/numerical_config_composite.json` 的精确表行核验；出其不意的 `1400110101_1` 仅在 `numerical_config_equip.json`，显式选择该表，不给其他缺行做隐式回退。核验字段为 Settlement、HpCalScale、HpCalBase、破韧、元素、暴击与弱点开关。基础攻击力型伤害按攻击力 500 折算；间接和自定义伤害保留执行输入，不误乘 500。技能扩散及妙手强化的静态值为 `0.5303 × 500 = 265.15`，不沿用之前的 265.2。

`scripts/trigger-damage/current-evidence.json` 保存这次选定配置字段、条目、源表及选定执行资产的 SHA-256；它用于审计，不是运行时原表读取入口。配置值一致不代表每条执行链均已重新验证，以下分别记录本次展开的链路和仍然存在的缺口。

通用 BD/S4 区间 `11010000..11010149` 的所有一级生命伤害行均须被收录或明确排除。排除：`11010051_1` 已有赛季天赋归属；`11010061_1` 是回能设计的零伤害行；`11010130_1` 明确为占位符；`11010138_1` 仅击退、基础生命伤害为零。治疗、护盾恢复不属于生命伤害。该区间检查不宣称扫描了全部游戏、武器、怪物或其他赛季天赋。

`11010053_2` 和 `11010053_3` 的实际 raw.ID 分别为 11010056、11010059，raw.Level 都是 1；表行名保持原样，禁止按 raw.ID 改键或把后缀解释为等级。其他来源与未归属配置不伪造普通插件、ItemID 或超限卡片关联，描述中的概率不作为已确认触发条件发布。同名的泡爆增伤、捡货炸环也不与现有插件强行合并。

## 本次展开的执行链

下列路径相对 Content。完整字节码由已安装 `nzm-uasset` 的 `Convert-LocalAsset.ps1 -ReadScriptData` 原地读取选定本地 `.uasset/.uexp`，输出位于 `MD/_local/trigger-damage/20261111/`，不修改参考源。已有包读取 profile 仅挂载旧补丁 4261608，与当前 S4 导出不一致，未使用它补齐缺失资产，也没有复制或批量导出包体。

| 条目 | 身份与关键节点 | 采用结论 |
| --- | --- | --- |
| 爆破强化 | Item20703040514 → Passive1315237001_1 → MGE1315237001；`ExecuteUbergraph@374` 检查 bIsDead，`@469` 读取击杀结算伤害，`@596` 调用 AOE1302101025 / Numerical11010140，传入原结算伤害；CDO CustomCD=1 | 原伤害的 33%，间接伤害；不能写成固定 165。自定义冷却检查的 Native 返回语义未在本次展开，不把配置冷却宣称为实测频率 |
| 疾风残影 | Item20703040523 → Passive1316218001_1 → MGE1316218001；`@1515` 用 SpawnEffectZoneInterval=2 建周期规则，`@2028` 选择 S4_ElectricArc，Duration=2；`DT_EffectZone#S4_ElectricArc.DetectConfig.Settlements` → 11010142 | 每次接触基础 200，物理技能伤害；电弧表现不是电弧元素证据 |
| 瘟疫之源 | Item20703040507 → Passive1316234001_1 → MGE1316234001；CDO EffectZoneDuration=5、CooldownDuration=10；`DT_EffectZone#S4_PoisonZone` 每秒执行敌方11010136，友方另用11010137 | 敌方100/次，物理技能伤害；MGE到该区域的执行链尚缺字节码，保留 pending |
| 余烬积势 | Item20703040530 → Passive1316220001_1 → MGE1316220001；`ExecuteUbergraph@706` 调用 AOE1302101020 / Numerical11010144 | 基础2500，物理技能伤害；普通插件CollectMODItem=0，列未上线 |
| 万伤掷弹 | Item20703040473 → Passive1316212001_1 → MGE1316212001；CDO DamageThreshold=10000、CooldownDuration=0.1 | 修正“未见独立冷却”为配置0.1秒；原投射物与父类121800070链保持既有记录 |
| 导弹与榴弹 | MGE1316210001@1542发射BP_Projectile_MGE_1316210001，其NamedThrowableSettlementConfig.Damage=121800050；MGE1317229001@1120发射BP_Projectile_MGE_1317229001，配置同为121800050；MGE1317232001@357、MGE1317234001@383调用父类LaunchProjectile_ISM，BP_MGE_ISMProjectile_Base.NumericalID=121800052；MGE1316212001@1294发射BP_Projectile_MGE_1316212001，父类BP_Projectile_Normal_Base.Damage=121800070 | 对应单发基础均2100；父类没有配套本地原始资产，父类内部执行未重新展开，卡片说明保留此边界 |
| 换弹冲击 | MGE1316211001@1268直接调用AOE1316200001 / Numerical121800060，CDO AOEInterval=1、AOEDuration=5；动态Modifier111051004_1_0为AllDamageRatio/B1/BaseValue=0/CoefValue=0.02 | 基础1800/次；沿既有执行输入审定每1%换弹速度提供2%冲击波增伤，不采用描述中的2500或暴击率转换 |
| 爆毒蚀域毒池 | MGE1316213001@857发射ProjectileClass=BP_Projectile_MGE_1316213001，后者EffectZoneName=QTPSQ_PoisonZone_1；该区域DetectConfig.EffectCheckInterval=1，敌方NumericalID=121500071 | 毒池350/秒；投射物自身继承121800070配置，但父类实际执行和ApplyConfig是否改变未核到，不将其直接追加为确认的敌方爆炸伤害 |
| 换弹引爆 | Item20703040528 → Passive1316219001_1 → MGE1316219001；`@2710` 的AOE参数1302101021、Numerical参数11010143；`@4107/@4166` 目标数上限5，`@4245` ScopedModifier111051058；`@2523/@2602/@2634` 卡片层数减1作为111051081输入 | 基础1250；111051058_1_0为SkillDamageRatio/B1/CoefValue=0.2，每个标记目标+20%，最多5个；111051081_1_0为ExecutionRatio/B1/CoefValue=1，每个额外卡片层+100%。首卡不额外+100%，其他乘区仍分别结算 |
| 光辉贯穿 | Item20703040478 → Passive1315250001_1 → MGE1315250001；`InitiVirtralGun@40` 以NumericalID_VirtualGun=11010149创建虚拟枪，`ExecuteUbergraph@2006` SimulatedShoot传入PenetrateNum=3 | 基础175，可暴击、可弱点；实际弱点倍率缺少虚拟枪/关联武器完整覆写证据，保留null |
| 近战冲击 | 当前原生卡1317240001 → MGE1317240001 → MGE1317042221；后者`ExecuteUbergraph@639` 调用AOE1300042220 / Numerical121800080 | 基础1250、破韧2.5，物理技能伤害；CDO冷却0.5秒。与普通插件的历史身份不混为投放证据 |
| 死神时刻 | 当前原生卡1317110001 → MGE1317110001；`@1506` 将SKT_AtomDeathMoment.AttackNumericalID设为112044020，`@1543` BaseDuration=2，`@1702` 激活23010303 | 参数行单次基础1200；沿既有审定暴击率转换为每1%暴击率提供1%增伤。技能内部字节码缺失，实际攻击频率与总伤害不计算，保留pending |
| 二重高伤 | 当前原生卡1317129001 → MGE1317129001；`@847/@889` 比较伤害与目标MaxHealth×0.1，`@188` MGEMakeSettlement(112029001,原伤害)，CDO冷却5秒 | 自定义结算，不能乘攻击力500；Native最终输入消费与倍率未展开，保留pending，不断言复制等量最终伤害 |
| 壁垒四件 | 当前羁绊1004 → Passive1378030230_1 → MGE1378030230；CDO爆炸X5伤害=130103006，`@887`提交自定义冷却2秒，`@985`将该字段传给AOE | 基础2500，破韧5，可暴击、不可弱点 |
| 狙击四件 | 当前羁绊 → Passive1378030260_1 → MGE1378030260；`@670`调用AOE1378030260 / Numerical130103010，`@1680`查询半径500厘米，`@2101`怪物数>=5；CDO CooldownDuration=20，`@495`提交MGE冷却；三张MGE参数表无对应覆写 | 基础5000，破韧10，可暴击、不可弱点；配置20秒，拒绝旧描述10秒和“超过5个”，同步修正当前羁绊摘要 |

## 仍然缺失的证据

双星回响、黑洞吞噬、矩阵湮灭、战灵余烬只具当前JSON默认属性，本地没有配套原始资产和可用同版字节码，继续保留既有 pending。不能因为本次数值行再次吻合就删除缺口。矩阵友方人数倍率、战灵余烬能量倍率不从卡面补成已确认公式。

S2核爆执行资产缺失，保留历史描述及未确认的Settlement、元素、暴击和弱点字段；不当作当前可获得。异化羁绊已不在当前超限羁绊池，旧混沌核爆只保留名称区分，不继续宣传为当前机制。

## 复核与发布

```powershell
pnpm exec tsx scripts/trigger-damage/audit.ts --content-root refs/Exports/NZM/Content --output-directory MD/_local/trigger-damage/<本次目录>/publish --reviewed-at YYYY-MM-DD --prepare-overlimit
```

脚本逐行核验数值、伤害类型、元素、破韧和暴击/弱点开关，检查通用区间覆盖，输出数值审计与独立超限候选，不刷新武器/Modifier Lock。生成候选时，选定执行资产、CDO与区域配置必须匹配已提交的审定哈希，字节变化或新增资产直接拒绝；普通数值审计仍可输出差异所需的诊断。触发条件、引用链和公式仍需按上文执行证据审定，不以通过数值检查替代执行审查；更换版本必须重新核验选定执行资产，不能仅重新生成哈希。

复核候选后，将生成的 `evidence.json` 保存为 `scripts/trigger-damage/current-evidence.json`，使用既有 `overlimit activate --catalog ... --review ...` 归档并激活；不在运行时合并普通插件。原池未覆盖的其他独立伤害保持快照原值，未归属配置不进入卡片快照。运行独立伤害与超限测试，再同步派生数据。维护路线见[超限赛季维护](../workflows/overlimit-season.md)。

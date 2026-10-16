# NZM Wiki 机制术语

> 状态：active

本文定义站点在描述游戏数值、属性效果和来源索引时使用的统一语言。它用于避免把原始数据字段、玩家可见效果和伤害公式中的乘区混为一谈。

## Language

**Num Modifier 行**：
`numerical_modifier_config` 中由正式服模式和 `row_name` 唯一标识的一条原始配置事实。
_Avoid_: Num 值、Modifier 类型

**属性类型**：
对一个或多个 `AttributeName` 的规范化机械含义，回答“修改了什么属性”，例如暴击率、移动速度或伤害抗性。
_Avoid_: 属性字段、乘区类型、效果类型

**Modifier 效果**：
Num Modifier 行在已知 operation、数值字段和作用上下文下产生的一次属性变化。
_Avoid_: Num Modifier 行、属性类型

**效果方向**：
Modifier 效果相对属性类型正向轴的变化，固定为增加、降低、中性或未知。
_Avoid_: 正 Buff、负 Buff

**索引分面**：
由属性类型、效果方向和必要上下文共同导出的玩家查询类别，例如减速、易伤或破韧效率。
_Avoid_: 属性类型、乘区

**Modifier 来源**：
向角色、敌人或伤害事件施加一个或多个 Modifier 效果的稳定游戏实体，例如插件、卡片、技能或状态效果。
_Avoid_: Modifier 行、属性类型

**伤害通道**：
能够参与最终伤害公式或伤害适用矩阵的索引分面，是通用 Modifier 索引面向乘区消费者的投影。
_Avoid_: 属性类型、所有 Modifier 效果

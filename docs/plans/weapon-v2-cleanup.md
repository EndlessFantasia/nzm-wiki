# Weapon Numerical V2 收尾计划

> 状态：proposed
> 前置：LC 与 TD 共 224 份武器已经迁移为 `schema_version: 2`

## 目标

结束双格式阶段，让 V2、Weapon Data Lock 和 Resolver 成为唯一正式武器数据管线，并阻止 V1 字段重新进入仓库。

现行规范与架构：

- [`../standards/weapon-mdx.md`](../standards/weapon-mdx.md)
- [`../standards/weapon-numerical-v2.md`](../standards/weapon-numerical-v2.md)
- [`../architecture/weapon-source-reader.md`](../architecture/weapon-source-reader.md)
- [`../architecture/weapon-data-lock.md`](../architecture/weapon-data-lock.md)
- [`../architecture/weapon-resolver.md`](../architecture/weapon-resolver.md)
- [`../architecture/weapon-skill-charge.md`](../architecture/weapon-skill-charge.md)

## 已满足的前置条件

- V2 Schema、统一原表读取层、Lock 和 Resolver 已实现。
- 页面、搜索、图表和计算器已经统一消费 Resolver 输出。
- LC 与 TD 各 112 份武器均为 V2，迁移排除项已经清零。
- 迁移决策、报告和快照（`data/weapon-v2-migration-*.json`、`data/weapon-v2-pilot-snapshots.json`）已移出仓库，需要追溯时从提交 `b7ec722b` 读取。

## 工作内容

1. 删除 V1 解析和兼容字段，包括 `damage`、`damage_modes`、`extra_modes`、`damage_label`、`damage_label_text`、`mode_names`、`file_rate`、`weekness_multiplier`、顶层 `skill_cooldown`、`range`、`attenuation_begin`、`attenuation_end`、`attenuation_scale`，以及已经被 ASC、Feel 或 Lock 稳定替代的弹药、衰减和换弹副本。
2. 删除旧 `weapon.range` 领域字段及消费者；距离衰减只保留来源引用、标准化结果和有证据的来源级 override。
3. 删除正文 `<ActiveSkill cooldown={...}>` 的重复 CD，由统一标准化数据提供。
4. 删除 V1 转换函数、迁移 bridge、只服务旧格式的脚本和重复提取路径。
5. 将 `weapon-data:check` 接入 CI 或生产构建前置；检查必须只读。
6. 增加旧字段扫描，阻止新 MDX 写回 V1。
7. 检查客户端和 `public/` 不包含完整原表或无关 Lock 行。
8. 同步更新武器规范、录入流程、架构文档和测试 fixtures。
9. 将技能持续时间、阻回、击杀充能、全局增伤和未解字段留给独立后续项目，不在本任务中顺带实现。

## 硬性规则

- MDX 只负责选择原始数据、赋予 Wiki 语义和声明人工修正。
- Lock 是被引用原始行的构建快照，不接受人工编辑。
- `refs/` 只服务显式刷新和核验，普通构建不得读取。
- Prototype 负责发现和核验关系，不替代 MDX 的显式选择。
- LC 与 TD 独立解析，禁止跨表 fallback。
- 距离衰减按伤害来源从 ASC 解析；例外使用来源级 override，禁止按名称或武器类型硬编码。
- 主动技能基础充能优先取 PVE `ChargeNeedTime`，仅在 PVE 缺行时使用 GP `CooldownDuration`。
- 自动化遇到歧义必须报错或进入核验清单，不能猜测后写入。

## 验收标准

- [ ] 所有发布武器只使用 V2。
- [ ] 仓库不存在 V1 字段消费者、迁移 bridge 或旧领域 fallback。
- [ ] MDX、Lock、Schema、Resolver 和文档一致。
- [ ] 没有 `refs/` 的环境可以完成生产构建。
- [ ] 原始大表和无关 Lock 行不会进入客户端资源。
- [ ] Lock 检查能够阻止缺失、陈旧和未使用引用。
- [ ] 旧字段扫描已接入自动检查。
- [ ] 武器相关测试和 `pnpm build` 通过，代码规则检查按 [AGENTS.md](../../AGENTS.md#验证策略) 的实际影响范围执行。

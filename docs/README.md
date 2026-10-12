# 项目文档索引

本目录只保存需要随仓库共享的现行规范、架构说明、维护流程和待实施计划。`MD/` 是被 Git 忽略的个人工作区，不是项目规范来源；除非用户明确指定，否则不要读取其中内容。

## 使用规则

1. 处理仓库代码、数据或内容前，先查看本索引。
2. 按任务范围读取 `Required` 文档；`Optional` 只在需要对应背景时读取。
3. `active` 表示当前有效，`proposed` 表示尚未完成实施，不能当作现有行为。
4. 文档与代码不一致时，以可执行 Schema、类型和测试为准，并同步修正文档。

## 任务路由

| 任务范围 | Required | Optional | 状态 |
| :--- | :--- | :--- | :---: |
| 日常内容编辑后的派生数据同步、开发启动 | [`workflows/content-sync.md`](workflows/content-sync.md) | [`architecture/content-evidence-notes.md`](architecture/content-evidence-notes.md) | active |
| 本地 .uasset / .uexp 转 JSON | [本地转换流程](../.agents/skills/nzm-uasset/references/local-json.md) | [nzm-uasset](../.agents/skills/nzm-uasset/SKILL.md) | active |
| pak 更新概览、容器条目或前版对比 | [按需 pak 分析](../.agents/skills/nzm-assets/references/pak-analysis.md) | [nzm-uasset](../.agents/skills/nzm-uasset/SKILL.md) | active |
| Lua 脚本行为或函数版本差异 | [Lua 分析流程](../.agents/skills/nzm-assets/references/lua-analysis.md) | [按需 pak 分析](../.agents/skills/nzm-assets/references/pak-analysis.md) | active |
| Kismet 字节码导出、读取或参考库维护 | [`workflows/kismet-evidence.md`](workflows/kismet-evidence.md) | [nzm-uasset](../.agents/skills/nzm-uasset/SKILL.md) | active |
| 塔防陷阱详情、伤害及实测对照维护 | [`workflows/trap-content-audit.md`](workflows/trap-content-audit.md) | 无 | active |
| 猎场 Buff 数据导入、图标或图鉴维护 | [`workflows/status-effect-import.md`](workflows/status-effect-import.md) | [`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | active |
| 召唤物篇章、伤害、射速或关联索引维护 | [`workflows/summon-compendium.md`](workflows/summon-compendium.md) | [`architecture/multiplier-index.md`](architecture/multiplier-index.md)、[`workflows/status-effect-import.md`](workflows/status-effect-import.md) | active |
| 武器 MDX 新增、修改或审计 | [`standards/weapon-mdx.md`](standards/weapon-mdx.md)、[`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | [`architecture/weapon-resolver.md`](architecture/weapon-resolver.md) | active |
| 武器原表读取 | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | [`architecture/weapon-skill-charge.md`](architecture/weapon-skill-charge.md) | active |
| Weapon Data Lock | [`architecture/weapon-data-lock.md`](architecture/weapon-data-lock.md) | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | active |
| Weapon Resolver 或消费者 | [`architecture/weapon-resolver.md`](architecture/weapon-resolver.md)、[`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | [`architecture/weapon-data-lock.md`](architecture/weapon-data-lock.md) | active |
| 主动技能基础充能 | [`architecture/weapon-skill-charge.md`](architecture/weapon-skill-charge.md) | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | active |
| 武器技能目录、参数、插件替换变体及双向索引 | [`standards/weapon-skills.md`](standards/weapon-skills.md)、[`architecture/weapon-skill-charge.md`](architecture/weapon-skill-charge.md) | [`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md)、[`architecture/weapon-skill-duration-evidence.md`](architecture/weapon-skill-duration-evidence.md) | active |
| 插件数据导入或维护 | [`standards/perk-data.md`](standards/perk-data.md) | [`.claude/commands/import-perks.md`](../.claude/commands/import-perks.md) | active |
| 正式服平衡补丁同步 | [`standards/perk-data.md`](standards/perk-data.md)、[`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md) | [`architecture/balance-evidence.md`](architecture/balance-evidence.md) | active |
| 超限卡片短摘要、导入或 `effect_values` | [`standards/perk-data.md`](standards/perk-data.md)、[`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md) | [`architecture/multiplier-index.md`](architecture/multiplier-index.md) | active |
| 超限板块、赛季切换、归档与候选审计 | [`workflows/overlimit-season.md`](workflows/overlimit-season.md)、[`standards/perk-data.md`](standards/perk-data.md) | [`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md) | active |
| 插件与超限跨赛季版本、过渡期 Preview、历史归档与恢复 | [`workflows/content-versions.md`](workflows/content-versions.md)、[`standards/perk-data.md`](standards/perk-data.md) | [`workflows/overlimit-season.md`](workflows/overlimit-season.md) | active |
| Num Modifier Lock、Resolver 或消费者 | [`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md)、[`standards/num-modifier-semantics.md`](standards/num-modifier-semantics.md) | [`standards/perk-data.md`](standards/perk-data.md)、[`architecture/multiplier-index.md`](architecture/multiplier-index.md)、[`workflows/status-effect-import.md`](workflows/status-effect-import.md) | active |
| Modifier 通用来源索引或属性分面查询 | [`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md)、[`standards/num-modifier-semantics.md`](standards/num-modifier-semantics.md) | [`architecture/multiplier-index.md`](architecture/multiplier-index.md)、[`workflows/status-effect-import.md`](workflows/status-effect-import.md) | active |
| Boss 血量导入 | [`workflows/boss-health-import.md`](workflows/boss-health-import.md) | [`.claude/commands/import-boss-health.md`](../.claude/commands/import-boss-health.md) | active |
| Boss 机制视频与解包解析 | [`workflows/boss-mechanics-analysis.md`](workflows/boss-mechanics-analysis.md) | [`workflows/boss-health-import.md`](workflows/boss-health-import.md) | active |
| change-log TODO | [`standards/todo-workflow.md`](standards/todo-workflow.md) | 无 | active |
| 武器 V2 收尾 | [`plans/weapon-v2-cleanup.md`](plans/weapon-v2-cleanup.md) | 上述武器规范与架构文档 | proposed |
| 乘区双向索引 | [`architecture/multiplier-index.md`](architecture/multiplier-index.md)、[`architecture/num-modifier-v2.md`](architecture/num-modifier-v2.md) | 无 | active |

## 文档归属

- `standards/`：必须遵守的项目规则。
- `architecture/`：当前实现、接口与职责边界。
- `workflows/`：可重复执行的维护流程。
- `plans/`：尚未全部落地的设计或任务。

完成的计划和已经被替代的调查不迁入本目录。Git 历史负责保留共享历史，本地研究和临时产物继续放在 `MD/`。

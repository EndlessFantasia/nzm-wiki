# 超限赛季维护

状态：active。使用正式版与可选下一版预览两个通道，不建立运行时历史库。跨赛季归档、转正和恢复统一见[版本管理](content-versions.md)。

## 发布协议与来源

- `data/overlimit/current.json` 是正式发布投影，`preview.json` 是下一版预览，无预览时为 `null`。两版按通道与卡片 ID 隔离。
- `lib/overlimit.ts` 提供页面、搜索与站点地图统一入口。卡片 ID 独立；`perkItemId` 只表示人工确认的普通插件关联，没有插件实体的技能卡合法。
- `links.json`、`preview-links.json` 是派生关联，由 `overlimit project` 重建。普通插件及 Buff 的超限链接指向当前卡池，预览来源显式带通道。
- `effectValues` 和 `independentDamage` 保存同版已审结果，运行时不读取当前普通插件或武器 Lock 来重算。`provenance.files` 记录来源文件与 SHA-256，不代替数值审计。
- `season.id` 是版本身份，正式状态为 `current`，预览为 `preload`。未审规则使用 `null`，退出卡池不自动删除普通插件。
- 预览新旧卡按 ID 与正式卡池比较，只表示相对当前卡池的新旧，不表示历史首次出现；查询不读取历史归档。

## 准备候选

显式指定本次正式来源和对比来源，避免默认 Content 换版后误读：

```powershell
pnpm overlimit prepare --season <赛季> --content-root <本次Content> --against <上一版Content>
```

少量候选与差异写入 `MD/_local/overlimit/candidates/`，包含身份链、卡片字段、羁绊与配置缺口。输出不是发布协议，不导入插件、不刷新全站 Lock、不改站点图标。`rawDescription` 只用于名称和条件语义，数值遵循[插件 Numerical 证据规则](../standards/perk-data.md#数值证据规则)。

## 审定与生成

先核对身份和投放，再沿技能、MGE、Modifier 审计 Numerical；非 Numerical 数值核对 Ability/Buff 执行配置。保存精确引用和来源哈希，生成独立发布候选。

- ID 保持稳定，同名卡不能按名称合并。`weight` 缺配置时省略。
- 槽位优先同版本卡表明确标记，`bSlot4=true` 为四插；其余可按同 ID 插件表唯一有效 `MODSlotIndex.Values` 回退并记录来源。缺失或歧义时省略，不拿旧版或体验服槽位回填。
- 适用范围未核实设 `applicabilityKnown: false`，范围数组为空不表示全部武器。
- 羁绊档位使用 `RequiredCount`，保留 `mergeType` 和 `overrides`，不默认累加。地图羁绊轮换与副本开放排期分别核验；客户端 OnlyServer 表缺失时不猜概率或限制。
- 描述、结构化效果、独立伤害使用同一证据版本。未解析效果和具体缺口保存在逐卡 `partial` 中，不按卡片类别统一判待核实。
- 原生卡审定清单拥有 Modifier 选择集合，不自动并入 CDO 中可能停用的旧 ID。动态系数必须审定字段、单位和触发范围；`BaseValue=0` 不表示 CoefValue 无效果，全零 B1 行可判无效果。
- 独立卡片以 `source: { type: "overlimit-card", id }` 登记通用来源及 `applications` 或有依据的排除项，不伪造普通插件身份。
- 新图标只生成卡池选定资源，同路径不同内容使用新文件名。缺少底包纹理时只沿用精确同引用图标并记录 fallback；输出不写回 refs。

正式生成器使用现有 `prepare-preview.ts --channel current`，显式提供 `--content-root`、`--updated-at`、`--source-lock`、`--rules-review`、`--announcement`、`--source-review` 和 `--output-directory`。输出目录包含目录、逐卡/规则证据、来源候选和选定 Numerical；不会激活或覆盖共享 Lock。换季复用生成器，更换审定文件，不复制赛季专用实现。

底包哈希变化须重新审定，不直接刷新旧审定哈希。公告可辅助开放排期、获取限制和语义，但不能覆盖 Numerical。未知服务端模块保持 `null`。`current-evidence.json` 随正式版本归档保留，正式消费者不依赖历史预览证据。

当前正式证据见 [`current-source-review.json`](../../scripts/overlimit/current-source-review.json)、[`current-rules-review.json`](../../scripts/overlimit/current-rules-review.json) 和 [`current-evidence.json`](../../data/overlimit/current-evidence.json)。瞬暴会心伤害的 3 倍是既有用户明确指定的精确展示约定；导出配置的 2 倍冲突继续留在审定记录中，此约定不作为运行时实测或其他条目的通用规则。极寒领域 Modifier `120300175` 的执行消费链尚未证实，不计入发布增伤，证据缺口继续保留。

## 转正与专项激活

常规插件与超限共同转正使用[版本管理的 `content-version promote`](content-versions.md#已审预览转正)，统一处理来源、技能、预览清理和派生数据。

仅维护超限当前投影时，可使用专项入口：

```powershell
pnpm overlimit check --catalog <已审投影.json>
pnpm overlimit activate --catalog <已审投影.json> --review <审定记录.json>
```

审定记录包含 `status: approved`、对应文件的精确 `catalogSha256` 和说明依据的 `basis`。`activate` 校验协议、资源及审定摘要，自动归档并核验旧投影，再替换当前投影并生成关联，不需前置重复 `archive` 和 `verify-archive`。正式长期归档仍由版本工具负责。

涉及效果或伤害逻辑时运行 `test:overlimit-cards` 和对应专项审计；其他验证按 [AGENTS.md](../../AGENTS.md#验证策略) 选择。需要同步派生数据时执行 `pnpm sync`，发布构建不重复列出其已经执行的目录检查和索引生成。超限 Numerical 审计使用投影的 `provenance.contentRoot`，不盲读已换版的默认目录。

预览按登记目标生成独立投影及证据；普通插件预览仍需显式发布。只更新公告时可运行 `preview-announcement.ts`，不得借此改写 Numerical 或独立伤害。已完成的 S3/S4 操作时间线由 Git 历史保存，当前流程不携带过期发布状态。

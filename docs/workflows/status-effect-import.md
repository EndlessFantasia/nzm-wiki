# 猎场 Buff 数据维护

状态效果页面使用一份已提交的数据锁和确定性生成的 WebP 图标。构建与页面运行时只读取仓库文件，不读取 `refs/`。

## 数据链路

```text
猎场导出表
  → scripts/status-effects/extract.ts
  → scripts/status-effects/cli.ts → data/status-effects.json V2
  → Num Modifier Resolver → 页面 Modifier DTO
  → scripts/status-effects/relations.ts
  → data/status-effect-relations.json
  → components/StatusEffectCatalog*.tsx
  → data/posts/enemy-buffs.mdx / player-buffs.mdx
```

Required 源表：

- `refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json`
- `refs/Exports/NZM/Content/DataTables/GameFeatureConfig/ElementConfigDataTable.json`
- `refs/Exports/NZM/Content/DataTables/numerical_config_others.json`

确认插件施加来源还会读取 `WeaponModItemData`、`MGEPassive_BD`、`GPModularGameplayEffectTable` 和对应 MGE JSON。运行时只读取已提交的 `data/status-effect-relations.json`，不会读取这些导出文件。

不要替换为 TDM/PVP 专用 Buff 表。`refs/` 只作为本地抽取证据，不能成为站点运行时依赖。

## 收录规则

- 极性只接受 `Positive` 与 `Negative`，`Normal` 不收录。
- 敌方：`DisplayPlaceEnumBitmask` 为 `2` 或 `3`，且极性为 `Negative`。
- 玩家：显示位为 `1`、`3` 或 `4`，收录 `Positive` 与 `Negative`。
- 显示位 `3` 可以同时进入两页。
- 显示位 `4` 作为玩家特殊状态处理。
- 同一 `BuffID` 合并为一项，但 `variants` 必须完整保留每条内部行、名称、描述、持续时间、周期、叠层、图标与数值引用。
- `ElementConfigDataTable` 只补充四元素摘要和敌方/玩家 Buff 名称对应关系，不覆盖 Buff 主表。
- 四元素摘要中的实战持续时间、结算周期和叠层上限必须联查对应的敌方 Buff 主行；不能把 `ElementDuration`（例如 `99`）直接解释成异常持续时间。
- 当前页面以 S3 常规四元素体系为实战口径。S2 替代体系已经移除；其残留辅助行 `Cryo_S2_Decelerate`、`Shock_S2_Fragile` 只允许在完整配置中追溯，不进入默认玩家视图或当前四元素摘要。

当前基线为敌方 110 行合并成 91 项，玩家 1017 行合并成 705 项。源表升级后数量可以变化，但应先确认变化原因。

## 刷新与校验

```bash
pnpm status-effects:refresh
pnpm status-effects:check
pnpm test:status-effects
```

`status-effects:refresh` 会重新抽取 `data/status-effects.json` 与 `data/status-effect-relations.json`，并把被引用且存在源 PNG 的图标转换到 `public/webp/icons/status-effects/`。文件名由原始资产路径的哈希和名称生成，相同输入会得到相同路径。

`status-effects:check` 会重新抽取并比较已提交数据，同时检查：

- 数据锁是否过期；
- 生成图标是否缺失或存在过期文件；
- 图标豁免是否有原因；
- 指向替代公开图标的豁免路径是否真实存在。

源导出缺失 PNG 时，必须在 `data/status-effect-icon-exemptions.json` 中显式登记。可指定现有公开图标：

```json
{
  "/Game/Path/Icon.Icon": {
    "publicPath": "/webp/icons/elements/fire.webp",
    "reason": "复用已提交的元素图标"
  }
}
```

如果没有可靠替代图标，将 `publicPath` 设为 `null` 并写明原因。页面会显示统一的缺图占位，不能删除豁免后静默忽略。

## 数值引用

`GPModifyIDs` 只作为稳定 ID 保存在 `variants`，服务端通过 Num Modifier Resolver 联查已提交的 `data/num-modifier-lock.json`；`status-effects.json` 不再复制 Modifier 行或原表路径。`NumericalID` 继续联查 `numerical_config_others` 并写入 `references.numericals`。图鉴技术详情按 ID 展开；Lock 中找不到的历史引用继续保留原始 ID，并明确显示为“未解析”，不能猜测或删除。

## 关联内容与证据等级

图鉴把关联内容分成两类，页面文案不能混用：

- **确认施加来源**：插件 ItemID → 被动技能 → MGE → `AddBuff` 调用 → `BuffName` → Buff 表行的完整链路。`HasBuff`、`RemoveBuff`、中文名相似和共用 GPModifier 都不能单独证明施加关系。
- **同乘区内容参考**：Buff 的属性字段能映射到乘区，再列出使用同一伤害通道的插件、超限卡、武器技能或赛季天赋。它只用于继续查机制，不代表这些内容会施加当前 Buff。

乘区方向必须判断数值符号：`DamageBearRatio < 0` 才是易伤，`DamageBearRatio > 0` 是减伤；其他增伤字段至少有一个正向 `baseValue` 或 `coefficient` 才进入增伤乘区索引。

赛季天赋只索引仓库已经提交并有公开路由的 S3 数据。没有添加到站点的 S0、S1、S2 不扫描、不猜测，也不生成占位结果。这个限制只适用于赛季天赋；已经上线的插件仍按插件发布状态处理。

玩家视图的语义分组、可读摘要和搜索关键词在 `lib/status-effects.ts` 中从已提交数据派生。完整配置仍保留所有符合显示位规则的记录，不能因为玩家视图隐藏测试或占位项而删减数据锁。

## 发布检查

数据刷新后运行领域检查：

```bash
pnpm status-effects:check
```

派生数据需要更新时运行 `pnpm sync`；代码、页面及发布验证统一按 [AGENTS.md](../../AGENTS.md#验证策略) 选择。发布 build 已包含 Numerical 检查和索引生成，不额外重复执行。

两篇 MDX 位于 `data/posts/`，会自动进入文章归档、指南归档、搜索索引和站点地图。旧 `/posts/element` 当前保留；未来删除时需要单独处理重定向、站内链接和 canonical 迁移。

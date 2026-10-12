# 导入或更新武器

目标：为 `$ARGUMENTS` 创建或更新 Weapon Numerical V2 MDX，并刷新 Weapon Data Lock。

开始前读取：

- `docs/standards/weapon-mdx.md`
- `docs/standards/weapon-numerical-v2.md`
- `docs/architecture/weapon-source-reader.md`
- `docs/architecture/weapon-data-lock.md`

## 硬性规则

- 只写 `schema_version: 2` 和 `damage_sources`，禁止新增或恢复 `damage`、`damage_modes`、`extra_modes`、`mode_names` 等 V1 字段。
- MDX 保存稳定引用、Wiki 语义和有证据的 override；不要内嵌可由 Resolver 从 Lock 解析的完整原表数值。
- 名称、`label`、`group`、继承和 override 必须人工判断。不得根据 Numerical 描述、相邻编号或武器名称猜测。
- LC 与 TD 分别核验并显式选择来源，禁止跨表 fallback。
- `refs/` 只用于本次提取和校验，不得成为构建时依赖。

## 流程

1. 确认目标位于 `data/weapons/`、`data/weapons_td/` 或两者，并读取现有文件及同类 V2 示例。
2. 从 `WeaponItemTable`、`WeaponPrototypeConfig` 和结构化资源引用确认 `prototype_id`、`item_id`、Prototype Mode、Numerical、ASC、Feel 与主动技能候选。
3. 新文件先写最小 V2 frontmatter 和已确认的 `prototype_id`。需要候选证据时运行：

   ```text
   pnpm exec tsx scripts/extract-weapon-data.ts 武器名 --out MD/_local/weapon-import/武器名.json
   ```

   该输出只是候选证据，不能直接复制成 frontmatter，也不会替你确定语义。
4. 人工编写 `damage_sources`：为每个来源设置稳定 `id`、名称、分区和显式 `source`；只有证据确认时才填写继承或 typed override，并记录原因。
5. 编写或保留正文技能说明、演示和来源署名。不要重复维护 Resolver 已提供的基础数值。
6. 刷新并检查 Lock：

   ```text
   pnpm weapon-data:lock
   pnpm weapon-data:check
   ```

7. 引用或数值结构变化运行 `pnpm test:weapon-source-v2`、`pnpm test:weapon-resolver` 和受影响的消费者测试；纯正文修改只做内容解析与差异检查。其余验证按 `AGENTS.md` 的验证策略选择，TypeScript 修改使用定向 ESLint。新增资源路径必须经过站点既有的 `getAssetPath()` 边界。

遇到多候选、缺行、跨表差异或语义不明时停止自动写入，列出候选与证据等待人工裁决。

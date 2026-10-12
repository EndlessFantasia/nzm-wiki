从游戏导出数据发现并导入塔防敌人图鉴。参数：`$ARGUMENTS`。

## 数据边界

- 只读取 `refs/Exports/NZM/Content/DataTables/` 下的塔防和怪物 JSON。
- 入口、别名、排除项和实测覆盖以 `data/enemies/td/import-config.json` 为准。
- 保留已有 MDX 的昵称、攻击范围、索敌范围、未知扩展字段和正文。
- 不从 AI 蓝图猜测导出表没有提供的攻击范围或索敌范围。

## 执行流程

1. 运行 dry-run：

   ```text
   pnpm exec tsx scripts/import-td-enemies.ts
   ```

2. 审阅新增、更新、别名、排除项、图标变化和 `Blockers`。
3. 只有 dry-run 无阻塞时才执行写入：

   ```text
   pnpm exec tsx scripts/import-td-enemies.ts --write
   ```

4. 再运行一次 dry-run，确认没有待写差异。
5. 运行：

   ```text
   pnpm exec tsx --test scripts/import-td-enemies.test.ts
   ```

   通用验证按 `AGENTS.md` 的验证策略选择：代码修改使用定向 ESLint，发布前运行 build。

6. 报告新增和更新的 MDX、图标、排除项及验证结果。

不要直接覆盖整份 MDX，不要删除 `import-config.json` 中明确排除的历史条目或人工覆盖。

# 日常内容同步

状态：active。入口：`scripts/sync-content.ts`。

编辑站点 MDX、来源目录、语义或其他站点数据后，执行：

```powershell
pnpm sync
```

`pnpm dev` 保留原来的属性/技能校验和搜索索引生成，不自动执行完整同步。编辑内容后需要更新派生数据，或启动时提示索引过期，手动执行 `pnpm sync`。服务运行期间也可在另一终端执行。生产构建仍使用只读校验；构建前有内容修改时先同步。

## 执行顺序

1. `pnpm overlimit project`：更新当前及已发布预览的超限跨页关联。
2. `pnpm num-modifier:project`：从已有 Lock、语义与来源目录更新属性和乘区运行时投影。
3. `pnpm num-skills:project`：更新武器技能索引及输入哈希；必须在属性投影更新后执行。
4. 依次执行 `overlimit check`、`perks:check`、`weapon-data:check`、`num-modifier:check`、`multiplier-index:check`、`weapon-mode-diff:check`。
5. `pnpm index`：更新搜索索引与武器统计。
6. 运行 `scripts/generate-sitemap.ts` 更新站点地图。

每一步显示进度与实际命令。失败立即停止，退出码非零；修正报错后重新执行。已完成的生成步骤不回滚。同步命令本身不启动开发服务。

## 数据边界

同步只重建派生数据，不修改人工编辑的 MDX、来源目录或数值 Lock，不读取 `refs/`，不执行原表导入、资产导出、图片转换、版本切换或预览发布。

新增的数值引用如果尚未被 Lock 覆盖，需按对应数据维护流程审查并补充。插件预览编辑完成后，仍需显式执行 `pnpm perks:project --channel preview` 发布本地快照，再执行 `pnpm sync`；日常同步不会重新解析或覆盖已发布预览。

此命令不代替代码测试、生产构建或任务对应的专项审计。

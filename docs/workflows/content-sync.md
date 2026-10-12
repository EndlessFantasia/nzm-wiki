# 日常内容同步

状态：active。入口：`scripts/sync-content.ts`。

编辑站点 MDX、来源目录、语义或其他站点数据后，执行：

```powershell
pnpm sync
```

`pnpm dev` 只生成搜索索引和武器统计，然后启动开发服务，不执行完整数值审计或完整同步。索引生成仍会调用实际消费者，数据错误可能使生成失败。编辑内容后需要更新派生数据，或页面提示索引过期时，手动执行 `pnpm sync`；服务运行期间也可在另一终端执行。生产构建继续执行离线完整校验。

## 执行顺序

1. `pnpm overlimit project`：更新当前及已发布预览的超限跨页关联。
2. `pnpm num-modifier:project`：从已有 Lock、语义与来源目录更新属性和乘区运行时投影；只改审计备注或无关字段不使投影过期。
3. `pnpm num-skills:project`：更新武器技能索引；必须在属性投影更新后执行。普通正文修改不使技能索引失效，技能数据变化才需要更新。
4. 依次执行 `overlimit check`、`perks:check`、`weapon-data:check`、`num-modifier:check`、`multiplier-index:check`、`weapon-mode-diff:check`。
5. `pnpm index`：更新搜索索引与武器统计。
6. 运行 `scripts/generate-sitemap.ts` 更新站点地图。

每一步显示进度与实际命令。失败立即停止，退出码非零；修正报错后重新执行。已完成的生成步骤不回滚。同步命令本身不启动开发服务。

## 数据边界

同步只重建派生数据，不修改人工编辑的 MDX、来源目录或数值 Lock，不读取 `refs/`，不执行原表导入、资产导出、图片转换、版本切换或预览发布。

新增的数值引用如果尚未被 Lock 覆盖，需按对应数据维护流程审查并补充。插件预览编辑完成后，仍需显式执行 `pnpm perks:project --channel preview` 发布本地快照，再执行 `pnpm sync`；日常同步不会重新解析或覆盖已发布预览。

此命令不代替代码测试、生产构建或任务对应的专项审计。

## 静态构建

`pnpm build` 不移动源码或 `public/` 目录。`next.config.ts` 根据发布状态选择复合 `pageExtensions`，规则集中在 `scripts/static-build-config.ts`：`page.dev.tsx` / `route.dev.ts` 只在开发环境成为路由，其他条件路由分别使用 `overlimit.tsx`、`overlimit-preview.tsx`、`perk-preview.tsx`、`build-guide.tsx`、`s4-talent.tsx` 后缀。新增开发专用路由应使用 `dev.ts` / `dev.tsx` 后缀。

生产类型检查使用 `tsconfig.build.json` 排除 `.next/dev` 内的开发路由类型，避免开发与静态导出规则不同导致旧类型报错。Next 自动清理生产输出与类型并保留 `.next/cache`，构建脚本不再删除整个 `.next`。S4 天赋为草稿时，只在导出完成后裁剪 `out/webp/images/season-talents/s4`，本地原始资源保留。

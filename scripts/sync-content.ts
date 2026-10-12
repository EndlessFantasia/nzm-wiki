import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Rebuild derived files from local site content and committed locks only.
// Imports, lock refreshes and preview publishing require a separate review.
export const CONTENT_SYNC_STEPS = [
  ["更新超限跨页关联", "pnpm overlimit project"],
  ["更新属性与乘区索引", "pnpm num-modifier:project"],
  ["更新武器技能索引", "pnpm num-skills:project"],
  ["校验超限目录", "pnpm overlimit check"],
  ["校验已发布插件预览", "pnpm perks:check"],
  ["校验武器数值引用", "pnpm weapon-data:check"],
  ["校验属性、技能与消费者", "pnpm num-modifier:check"],
  ["校验乘区来源关联", "pnpm multiplier-index:check"],
  ["校验武器模式差异标记", "pnpm weapon-mode-diff:check"],
  ["更新搜索索引与武器统计", "pnpm index"],
  ["更新站点地图", "pnpm exec tsx scripts/generate-sitemap.ts"],
] as const;

export function runContentSync(execute: (command: string) => void = command => execSync(command, { stdio: "inherit", windowsHide: true })) {
  for (const [index, [label, command]] of CONTENT_SYNC_STEPS.entries()) {
    console.log(`\n[${index + 1}/${CONTENT_SYNC_STEPS.length}] ${label} (${command})`);
    try { execute(command); }
    catch { throw new Error(`内容同步失败：${command}。请根据上方错误修正后重试 pnpm sync。`); }
  }
  console.log("\n内容同步完成，所有校验通过。");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { runContentSync(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}

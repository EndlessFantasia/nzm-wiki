// tauri dev 的 beforeDevCommand：本地站点已在运行就复用，否则在仓库根目录启动 pnpm dev
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const devUrl = "http://localhost:3000";
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

try {
  await fetch(devUrl);
  console.log(`复用已运行的站点 dev server：${devUrl}`);
} catch {
  console.log("启动站点 dev server…");
  spawn("pnpm", ["dev"], { cwd: repoRoot, stdio: "inherit", shell: true });
}

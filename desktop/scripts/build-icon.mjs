// 由 app-icon.png 生成圆角图标，再交给 tauri icon 输出并清理用不到的尺寸
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SIZE = 1024;
const RADIUS = Math.round(SIZE * 0.22);

const desktopDir = fileURLToPath(new URL("..", import.meta.url));
const iconsDir = join(desktopDir, "src-tauri", "icons");
const workDir = mkdtempSync(join(tmpdir(), "nzm-icon-"));
const rounded = join(workDir, "app-icon-rounded.png");

const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`,
);

try {
  await sharp(join(desktopDir, "app-icon.png"))
    .resize(SIZE, SIZE, { fit: "cover", kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(rounded);

  const tauriCli = join(desktopDir, "node_modules", "@tauri-apps", "cli", "tauri.js");
  const result = spawnSync(process.execPath, [tauriCli, "icon", rounded], {
    cwd: desktopDir,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  // 只保留 tauri.conf.json 引用的 Windows 图标和托盘默认图标
  for (const name of ["android", "ios", "icon.icns", "64x64.png", "StoreLogo.png"]) {
    rmSync(join(iconsDir, name), { recursive: true, force: true });
  }
  for (const size of [30, 44, 71, 89, 107, 142, 150, 284, 310]) {
    rmSync(join(iconsDir, `Square${size}x${size}Logo.png`), { force: true });
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

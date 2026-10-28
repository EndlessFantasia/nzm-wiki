# 逆战未来维基 桌面端

Tauri 2 壳，直接加载线上站点 `https://nzm-wiki.com/`，不打包 `out/`。内容更新不需要发新版，壳只负责桌面能力。

## 功能

- 全局快捷键：默认 `Ctrl+Alt+N` 显示/隐藏窗口，切换置顶默认不绑定；可在设置页修改或清除，须含 Ctrl/Alt（单独 F1–F24 除外），保存在 `%APPDATA%\com.nzm-wiki.desktop\settings.json`
- 托盘菜单：显示/隐藏、窗口置顶、回到首页、刷新、刷新缓存、设置、退出；左键单击托盘图标切换显示
- 刷新缓存（托盘菜单或设置页）：只清空 WebView2 磁盘缓存并重新加载，Cookie 和 localStorage 中的站点偏好保留
- 设置页：站内路由 `/desktop/settings`（`components/DesktopSettings.tsx`），从站点顶栏齿轮（仅桌面端渲染）或托盘菜单进入
- 无系统标题栏：站点顶栏兼任标题栏（`data-tauri-drag-region="deep"`），右侧窗口按钮由 `components/DesktopWindowControls.tsx` 在桌面端渲染；壳在文档创建时给 `<html>` 加 `data-desktop`，供站点 CSS 区分桌面端
- 启动画面：主窗口隐藏加载站点，期间显示内置的 `src-tauri/splash/index.html`（自定义协议 `splash`，不走网络）；加载完成后至少停留 0.5 秒再淡出，10 秒仍未完成则直接显示主窗口
- 桌面端缓存（默认开启，设置页可关）：关闭按钮只隐藏窗口，进程常驻托盘，再次呼出无需重新加载，退出走托盘菜单；配合下面的站点更新检查保持页面为最新部署。关闭后与 Edge 打开站点一致：关闭即退出，不做额外检查
- 站点更新检查（`components/DesktopUpdateNotice.tsx`）：构建时 `scripts/build-static.ts` 生成版本号，注入页面并写出 `site-version.json`；隐藏在托盘时每 10 分钟、呼出时（间隔 ≥1 分钟）检查，发现新部署直接重载；前台使用时每 30 分钟或站内跳转（间隔 ≥5 分钟）检查，只在顶栏提示，下次点站内链接改为整页加载。有未保存编辑的页面通过取消 `nzm-desktop:before-auto-reload` 事件阻止自动重载
- 自动更新（`src-tauri/src/app_update.rs`）：启动 20 秒后及常驻期间每 6 小时检查 GitHub Release 上的 `latest.json`，也可从托盘「检查更新…」或设置页手动检查；发现新版本时顶栏齿轮标点、托盘显示「安装更新」，在设置页确认后下载、校验签名并以 passive 模式安装，完成后自动重启
- 记住窗口位置和尺寸；重复启动时聚焦已有窗口
- 站外链接和 `target="_blank"` 的站外链接交给系统浏览器打开

快捷键被其他程序占用时会注册失败，设置页会标出，对应功能仍可从托盘菜单使用。游戏需使用窗口化或无边框窗口模式，独占全屏下置顶窗口无法覆盖游戏画面。

## 开发

需要 Rust 工具链（MSVC）和 WebView2（Windows 11 自带）。

```bash
pnpm desktop:dev    # 调试运行，加载本地站点 http://localhost:3000
pnpm desktop:build  # 产出 NSIS 安装包到 desktop/src-tauri/target/release/bundle/nsis/，加载线上站点
```

`desktop:dev` 启动前会检查 3000 端口：已有站点 dev server 就复用，否则自动在仓库根目录运行 `pnpm dev`，退出时一并关闭。调试构建可用 `NZM_DESKTOP_URL` 改为加载其他地址，例如对照线上：

```powershell
$env:NZM_DESKTOP_URL = "https://nzm-wiki.com/"; pnpm desktop:dev
```

站点页面能调用的命令只在 `capabilities/site.json` 中授权；新增命令时同时在 `build.rs` 的 `AppManifest` 和该 capability 中声明，站点侧经 `lib/desktop.ts` 调用，并容忍旧版桌面端缺少该命令。文件系统、进程等敏感能力不开放给站点。壳向站点推送状态用 DOM 自定义事件（如 `nzm-desktop:pinned-changed`），不开放 Tauri 事件权限。

## 发布新版本

1. 同步修改 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `package.json` 中的版本号并提交。
2. 推送标签 `desktop-v<版本号>`（与 `tauri.conf.json` 不一致时工作流直接失败）。`.github/workflows/desktop-release.yml` 会构建 NSIS 安装包、签名，并连同 `latest.json` 发布为 GitHub Release；已安装的桌面端随后会收到更新。

更新签名私钥在仓库外的 `%USERPROFILE%\.tauri\nzm-wiki-desktop.key`（无密码），需把文件内容配置为仓库 Secret `TAURI_SIGNING_PRIVATE_KEY`；公钥写在 `tauri.conf.json` 的 `plugins.updater.pubkey`。私钥丢失后已安装的客户端无法再验证新版本，只能手动重装，务必另行备份。签名只在发布构建中通过 `src-tauri/tauri.release.conf.json` 开启，本地 `pnpm desktop:build` 不需要私钥。

Release 托管在 GitHub，国内网络下检查或下载更新可能失败，失败时设置页会提示，可稍后重试。

图标源图为 `desktop/app-icon.png`（方形 PNG，建议 1024×1024）。下面的命令会裁出圆角、生成全部尺寸，并只保留 `tauri.conf.json` 引用的文件和托盘用的 `icon.png`；`build.rs` 监听 `icons/`，重新编译即可嵌入新图标：

```bash
pnpm --filter nzm-wiki-desktop icon
```

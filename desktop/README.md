# 逆战未来维基 桌面端

Tauri 2 壳，直接加载线上站点 `https://nzm-wiki.com/`，不打包 `out/`。内容更新不需要发新版，壳只负责桌面能力。

## 功能

- 全局快捷键：默认 `Ctrl+Alt+N` 显示/隐藏窗口、`Ctrl+Alt+T` 切换置顶；可在设置页修改或清除，须含 Ctrl/Alt（单独 F1–F24 除外），保存在 `%APPDATA%\com.nzm-wiki.desktop\settings.json`
- 托盘菜单：显示/隐藏、窗口置顶、回到首页、刷新、设置、退出；左键单击托盘图标切换显示
- 设置页：站内路由 `/desktop/settings`（`components/DesktopSettings.tsx`），从站点顶栏齿轮（仅桌面端渲染）或托盘菜单进入
- 无系统标题栏：站点顶栏兼任标题栏（`data-tauri-drag-region="deep"`），右侧窗口按钮由 `components/DesktopWindowControls.tsx` 在桌面端渲染；壳在文档创建时给 `<html>` 加 `data-desktop`，供站点 CSS 区分桌面端
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

图标由 `desktop/app-icon.png`（1024×1024 方形 PNG）生成：

```bash
pnpm --filter nzm-wiki-desktop icon
```

生成后只保留 `src-tauri/icons/` 下 `tauri.conf.json` 引用的文件和 `icon.png`。

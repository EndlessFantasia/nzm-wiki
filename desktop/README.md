# NZM Wiki 桌面端

Tauri 2 壳，直接加载线上站点 `https://nzm-wiki.com/`，不打包 `out/`。内容更新不需要发新版，壳只负责桌面能力。

## 功能

- `Ctrl+Alt+N`：显示/隐藏窗口（全局快捷键）
- `Ctrl+Alt+T`：切换窗口置顶

快捷键被其他程序占用时会注册失败，对应功能仍可从托盘菜单使用。
- 托盘菜单：显示/隐藏、窗口置顶、回到首页、刷新、退出；左键单击托盘图标切换显示
- 记住窗口位置和尺寸；重复启动时聚焦已有窗口
- 站外链接和 `target="_blank"` 的站外链接交给系统浏览器打开

游戏需使用窗口化或无边框窗口模式，独占全屏下置顶窗口无法覆盖游戏画面。

## 开发

需要 Rust 工具链（MSVC）和 WebView2（Windows 11 自带）。

```bash
pnpm desktop:dev    # 调试运行
pnpm desktop:build  # 产出 NSIS 安装包到 desktop/src-tauri/target/release/bundle/nsis/
```

图标由 `desktop/app-icon.png`（1024×1024 方形 PNG）生成：

```bash
pnpm --filter nzm-wiki-desktop icon
```

生成后只保留 `src-tauri/icons/` 下 `tauri.conf.json` 引用的文件和 `icon.png`。

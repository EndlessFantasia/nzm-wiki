# NZM Toolkit 接入

NZM 解包、资产分析与 Mod 技能的维护来源是私有仓库 `lostlightll/nzm-toolkit`。本项目保留旧脚本路径作为兼容入口，实现在 Toolkit；站点数值、内容导入和参考库规则继续属于本项目。

## 安装与版本

1. 克隆 `https://github.com/lostlightll/nzm-toolkit.git` 到个人工具目录，安装 Git LFS 并执行 `git lfs pull`。
2. 按本项目根目录 `nzm-toolkit.json` 的 `revision` 检出固定提交；再执行 `git lfs pull`。
3. 运行 Toolkit 的 `scripts/Install-Skills.ps1` 建立用户入口，或设置 `NZM_TOOLKIT_ROOT` 为其完整仓库路径。
4. 私有 profile 继续位于本项目忽略的 `MD/_local/nzm-assets/nzm.json`；不提交或复制配置内容到工具仓库。
5. 运行本项目 `.agents/skills/nzm-assets/scripts/Test-BundledCli.ps1`。它验证固定 EXE，不挂载游戏。

兼容入口会核对 Toolkit 提交与本项目固定版本一致。升级时先完成 Toolkit 的构建、测试和发布，再更新本项目的 `nzm-toolkit.json` 并验证相关工作流。不把本机绝对路径链接提交到项目仓库。

## 命令与说明

以下旧入口保持调用参数与输出格式，工作目录明确设为本项目，默认解析工具来自 Toolkit 的固定运行版本：

- `.agents/skills/nzm-assets/scripts/Invoke-Nzm.ps1`
- `.agents/skills/nzm-uasset/scripts/Convert-LocalAsset.ps1`
- `scripts/inspect-nzm-bytecode.ps1`
- `scripts/summarize-nzm-bytecode.py`

需要开发构建时显式传入原有 `-CliPath`、`-LibraryDirectory`、`-AssemblyPath` 等参数；不会默认使用 FModel 源码目录的最新输出。

技能与细节在已安装的 Toolkit 内：

| 任务 | Toolkit 内路径 |
|---|---|
| pak 概览、选定条目和版本对比 | `skills/nzm-assets/references/pak-analysis.md` |
| Lua 函数与字节码差异 | `skills/nzm-assets/references/lua-analysis.md` |
| 本地资产转 JSON | `skills/nzm-uasset/references/local-json.md` |
| Kismet 判读 | `skills/nzm-uasset/references/kismet.md` |

`refs/`、`refs-test/` 和已有 `kismet/` 证据仍只读，输出和快照遵循本项目规范。导出结果不能直接替代 Numerical 身份链核验或授权重写站点数据。

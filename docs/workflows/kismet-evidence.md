# Kismet 本地参考库

`kismet/` 与 `refs/` 并列，用于保存完整字节码导出及其来源记录。整个目录被 Git 忽略；规范、工具代码留在仓库中，游戏导出不提交、不上传，也不作为站点运行或构建输入。

## 目录

```text
kismet/
  unknown/                   来源环境未确认
    <UTC时间>-<随机ID>/       一次导出的独立快照
      manifest.json
      json/NZM/Content/.../*.uasset.json
  live/                      已确认正式服
  test/                      已确认体验服
```

三个环境使用相同的快照结构。保留完整虚拟资产路径，避免同名文件冲突。快照时间是导出时间，不是游戏版本；随机 ID 不参与新旧版本排序。

分析时只读已生成文件。新导出创建新快照，不覆盖、修补或删除原始证据；不通过手工修改 JSON 消除解析差异。复用前确认来源，不能仅按修改时间挑选“最新游戏版本”。

## 导出

从项目根目录执行 `scripts/inspect-nzm-bytecode.ps1`，传入准确虚拟路径；`-Dataset live|test|unknown` 声明已确认的环境，默认 `unknown`。该参数只分类输出，不选择游戏安装，实际来源由私有 profile 决定。`-SourceLabel` 可记录人工确认的构建号或版本，不含密钥、账号或私有配置内容。

```powershell
& scripts/inspect-nzm-bytecode.ps1 -Assets 'NZM/Content/exact/path.uasset' -Dataset live -SourceLabel '已核实的版本标识'
```

使用实际搜索结果替换示例路径。默认程序集来自固定版本 Toolkit 的 `runtime/libraries/FModel.Cli.dll`，私有配置仍为本项目的 `MD/_local/nzm-assets/nzm.json`。安装和版本核对见 [NZM Toolkit](nzm-toolkit.md)。其他安装用 `-AssemblyPath`、`-ProfilePath`；显式传入的相对路径以项目根目录为基准，仍支持绝对路径覆盖。程序集与 PowerShell/.NET 须兼容。赛季入口 `scripts/s0s1-season-talents/export-taboo-script.ps1` 委托同一导出器并复用默认值，保留原有参数和包含 `output` 的 JSON 返回格式。

每次导出写入 `manifest.json`：环境、可选版本标签、时间、请求资产、工具程序集哈希、状态和已导出文件的 SHA-256。只记录必要来源信息，不序列化 profile。`exported` 只表示导出请求完成，不证明所有函数解析完整；失败快照标为 `failed`，未正常结束的快照保留 `in-progress`。读取时仍须检查目标函数的 `ScriptBytecode` 和解析诊断。

需要排除已确认的残留旧容器时，可传 `-ExcludeContainer <精确容器名或绝对路径>`；必须使用支持该参数的 CLI 程序集，旧程序集会明确拒绝，不能静默退回混合来源。排除在原地挂载阶段生效，不复制或移动包体；manifest 的 `excludedContainers` 只保存容器文件名，不保存私有 profile 或安装路径。

## 使用与历史资料

- 定位文件可用 `rg --files --no-ignore kismet`，再按目标资产名筛选；内容搜索也须显式包含忽略文件。
- 引用具体快照文件、对象/函数及字段或原始指令定位；复核时与 manifest 哈希比对。
- 字节码判读使用已安装 Toolkit 的 `skills/nzm-uasset/references/kismet.md`，接入方式见 [NZM Toolkit](nzm-toolkit.md)。摘要、伪代码、人工分析和临时文件放 `MD/_local/nzm-uasset/<主题>/`，指向原始快照，不写回参考 JSON。
- `.uasset` 原始包保留在 `nzm-assets` 的导出位置；参考库不存放 profile、mappings、工具副本或构建缓存。
- 历史 `MD/_local/nzm-bytecode/`、`nzm-assets/s1-kismet-*` 及主题目录继续作为旧引用使用。归档旧证据时先核对来源、哈希及调用方，再新增对应快照与原路径记录；未知环境归入 `unknown`。此次目录统一不批量移动旧文件。

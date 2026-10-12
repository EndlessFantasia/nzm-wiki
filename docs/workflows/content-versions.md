# 插件与超限的跨赛季版本管理

状态：active。版本工具负责候选工作区、已审内容迁移和展示快照；Git 负责源码合并与历史代码。工具不提交、推送或部署，不按日期自动换季。

## 数据所有权与归档

`config/content-version.json` 声明工作区的 `season/version/phase` 和可选的下一版 `preview`。`candidate` 表示维护中的候选，`current` 表示完成本地发布核验，不代替部署状态。日常文字修正无需新建版本。

- 普通插件正式内容由 `data/perks/slot-*/*.mdx`、正式 Lock 和 Resolver 解析；预览编辑源位于 `data/perk-preview/slot-*/*.mdx`，发布后冻结到 `preview.json`。
- 超限正式内容使用 `data/overlimit/current.json`，下一版预览使用 `preview.json`，无预览时为 `null`。两版卡片、独立伤害、羁绊、等级和地图轮换互相隔离。
- 历史位于 `archives/content-versions/<season>/<version>/`，不进入站点运行、搜索或静态资源部署。归档随 Git 保存，但工具不自动提交。
- 归档保存插件 MDX、已解析展示及伤害、超限投影、关联证据和所引用的站点图像。预览原文取已发布快照，不取未发布编辑源。原始文件与解析结果都保留，防止当前 Lock 改变历史展示。
- Numerical 证据仅用于追溯，不能整体覆盖共享 Lock。武器不纳入版本切换；插件引用的武器伤害保存当时解析结果。
- `manifest.json` 保存身份、时间和逐文件 SHA-256；归档不可覆盖。`.gitattributes` 保留归档原始字节，完整性由哈希校验。

```powershell
pnpm content-version status
pnpm content-version archive
pnpm content-version archive-preview
pnpm content-version verify --archive <归档目录>
```

`archive` 仅保存正式版，`archive-preview` 保存正式底座与已登记预览，不能将过渡快照当作下一季正式归档。快照描述归档时维护数据的实际状态，不证明某一天完整客户端的状态。超限单次操作的本地备份仍可使用 `overlimit archive`，不替代正式版本归档。

## 候选工作区与预览

先归档并提交当前版本，再执行：

```powershell
pnpm content-version prepare --season <下一赛季> --version <下一版本>
```

命令要求工作区干净，创建候选分支和独立 Git 工作区；安装依赖后在候选工作区维护。初始内容仍来自上一版，修改版本号不表示已完成换季。准备期间的正式修正通过 Git 合并或 cherry-pick 带入，发布前再合并维护分支。

需要先撤下已过期正式版时，显式执行 `content-version withdraw --archive <当前正式归档> --season <下一赛季> --version <下一版本>`，随后运行 `pnpm sync`。撤下前比对归档哈希，只移除已归档的正式内容，预览保持独立。

在版本配置登记 `preview: { season, version, label }`；预览插件及 Modifier 来源使用 `<season>-preview` 通道。同 ItemID 可在正式与预览各有一版，按通道隔离，普通插件的引入赛季不因切换通道重标。预览 Numerical 证据必须绑定目标赛季，缺行或跨赛季不得回退正式值。

按[插件标准](../standards/perk-data.md)及[超限流程](overlimit-season.md)准备、审计内容。未核验草稿留在候选工作区；服务端未知规则使用 `null`，不继承旧版。插件预览编辑完成后显式执行 `pnpm perks:project --channel preview`；需要更新关联投影时运行 `pnpm sync`。构建不隐式发布编辑源。

预览运行时只读发布快照，不随共享武器或 Lock 更新重算。重新发布前仍须复核武器来源是否适用于目标版本；来源哈希用于追溯，不代替机制审定。`preview_change` 为 `new/changed/existing`，分类仅供预览展示；投放状态不等于正式上线日期。超限卡片的证据缺口逐项声明 `verification.status: partial` 并省略未证实数值。

## 已审预览转正

先保存上一正式版和需要保留的已发布预览归档。在候选工作区复核正式客户端、正式 Numerical Lock、插件文案及触发伤害；技能 runtime 必须有正式执行链绑定，预载值不能改名成为正式证据。

超限生成器的正式候选目录应包含 `catalog.json`、`evidence.json`、`providers.json`。审定文件继续使用 `status: approved`、精确 `catalogSha256` 和非空 `basis`。插件来源需要修正时准备独立来源候选。随后统一执行：

```powershell
pnpm content-version promote --season <赛季> --version <版本> --content-root <正式Content> --archive <已发布预览归档> --baseline <上一正式归档> --candidate <已审超限候选目录> --review <超限审定文件>
```

默认只读，输出插件、来源、技能、配置差异和阻塞项；增加 `--write` 才应用。`--perk-providers <文件>` 可提供已审正式插件来源替换项。来源候选沿用现有协议，不需要复制全站目录或创建新的审批文件。

入口先完成归档、版本、资源、正式 Lock 和技能预检。插件按 ItemID 定位目标并核对插槽；相同内容跳过且保留原字节，不同内容列出冲突并阻止全部写入。工具不覆盖已有编辑；先人工合并对应正式与预览来源再重试。

执行依次迁移插件、替换超限及保存证据、合并来源和技能声明、从正式 Content 刷新当前技能行、清理本季预览消费者与配置，最后执行既有 `pnpm sync`。技能只修改协议字段，不改名称、正文或证据里的通道文字。缺少经审定的正式 runtime 绑定会阻止转正，不从预览复制。

写入前将本次站点文件和派生产物备份到 `MD/_local/content-versions/promotions/`；超限旧投影自动归档并核验，不需先手工重复备份。失败恢复本次确认写入的文件；检测到并发修改或中断生成器的产物归属不明时，保留文件并输出恢复冲突及备份路径。先核对冲突再重试。

成功保持 `phase: candidate`，不运行 build 或正式定版。重复执行已完成的迁移只报告 `already-promoted`。底层 `scripts/perks/promote-release.ts`、`scripts/content-versions/promote-shared.ts` 继续供专项维护兼容使用，常规换季统一使用上述入口。

## 正式定版、对比与恢复

```powershell
pnpm content-version finalize
```

仅候选可定版。命令验证正式超限版本、插件通道和本季预览清理，执行 `pnpm build`，通过后标为当前版并生成不可覆盖的正式归档；失败不标记成功。检查不代替来源审计。复核后按正常 Git 合并与发布流程上线，通用验证遵循 [AGENTS.md](../../AGENTS.md#验证策略)，不重复列出 build 已包含的检查。

```powershell
pnpm content-version diff --left <归档A> --right <归档B>
pnpm content-version export --archive <归档目录> --output MD/_local/content-versions/recovery/<版本>
```

对比先验证两份归档，按文件报告增删改。导出仅写全新目录。恢复旧页面行为时在独立 Git 分支审查归档记录的代码提交，再选择恢复内容并运行现行校验；`evidence/` 不整体覆盖当前项目。旧版本无需兼容当前 Resolver，也不需要新增网站历史页面。已完成的换季操作记录由 Git 历史保留。

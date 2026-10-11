# Num Modifier V2

> 状态：active
> Lock Schema：`data/num-modifier-lock.json` V2
> 语义目录 Schema：`data/num-modifier-semantics.json` V1
> 来源目录 Schema：`data/modifier-providers.json` V1

## 目标与所有权

Num Modifier V2 把正式服 Modifier 原始事实、属性描述、人工语义和来源索引收进一个深模块。消费者声明稳定表达式和作用上下文，不复制属性名、operation、方向、分面或数值；构建和页面运行时不读取 `refs/`。

```text
numerical_modifier_config ─┐
                           ├─> Num Modifier Lock V2 ─┐
AttributeDescMapTable ─────┘                         ├─> Resolver
num-modifier-semantics.json ─────────────────────────┘    ├─> modifier-index-runtime.json
modifier-providers.json ──────────────────────────────────┤
                                                         └─> multiplier-providers-runtime.json
```

- Lock 保存原表事实和来源哈希，不保存玩法结论。
- 语义目录是属性类型、operation 解释、方向和索引分面的唯一人工事实。
- 元素等属性子类型使用可选 `qualifier` 保存稳定维度、ID、标签和顺序，消费者不得从 `AttributeName` 后缀猜测。
- 来源目录保存实体身份、Num 表达式、接收者上下文和证据，不复制机械分类。
- 运行时投影保存客户端查询所需的已解析结果和输入哈希，不导入完整 Lock。
- `lib/num-modifier-data.ts` 是完整 Lock 与语义目录的唯一业务导入适配器。

### 内容预览隔离

版本配置 `config/content-version.json.preview` 登记唯一的下一季预览，`<season>-preview` 表示其数据通道（当前为 `s4-preview`）。预下载武器的增伤来源同样可在 `modifier-providers.json` 的武器 `source` 声明此标记，通过来源 Resolver 选择隔离证据。此标记只影响该来源的 Modifier 解析，不修改武器伤害 Lock 或正式 Modifier Lock。预览生成器保留插件与武器来源显式引用的选定行；未标记武器来源仍使用正式 Resolver。

`data/perk-preview-modifiers.json` 保存预览插件、预览武器增伤来源及预览超限卡片/羁绊实际引用的 Numerical 行，格式为 `{ schema_version: 1, season: "s4", source: { path, sha256 }, rows: { [rowName]: raw } }`。`season` 显式绑定证据赛季，`source` 记录预载原表路径与 SHA-256，运行时不读取该路径。原始行必须包含有效的 ID、Level、AttributeName、GPModifierOp、BaseValue 和 CoefValue。

`getPerkModifierResolver(season)` 仅对与登记目标及证据一致的预览标记使用选定行；缺行不回退正式 Lock，普通插件使用正式 Resolver。未登记、跨赛季或证据缺失的预览请求报错，不能静默用正式数值或上一季预览证据代替。描述模板、数值绑定、阶段值和效果分面均使用同一个选定 Resolver。乘区来源投影也通过 `getProviderResolver()` 按来源的预览标记选用该 Resolver，预览证据哈希参与投影新鲜度检查。正式 `data/num-modifier-lock.json` 与未标记的消费者不受预览行影响，不能通过刷新正式 Lock 发布预载中的旧行改动。

## Lock 与身份

```text
schema_version = 2
sources.lc.modifiers = { source_path, sha256, row_count }
sources.lc.attribute_descriptions = { source_path, sha256, row_count }
rows.lc[row_name] = { row_name, raw }
attribute_descriptions.lc[row_name] = { row_name, raw }
```

- Modifier 对外引用固定为 `lc:<row_name>`；`row_name` 是权威身份，不按 `raw.ID` 重写。
- 属性描述只通过 `raw.attr_realname` 连接，不提供业务手写引用。
- `Description` 只作诊断。数值读取 `BaseValue`、`CoefValue`、`GPModifierOp` 和 `Level`。
- 对象键递归排序，数组顺序保持；两张源表分别记录 SHA、行数和刷新差异。

S4 正式服 Lock 有 3,675 条 Modifier、188 条属性描述和 171 个非空 `AttributeName`。其中 153 个可连接描述表，18 个缺少描述；另有 `lc:191201003_1_0` 的空属性异常。`lc:111970001` 的非标准 row name 和 `lc:111010094_1_1` 的身份不一致同样作为诊断保留。新增属性先按属性描述表登记为已识别但未索引，缺少描述的塔防属性保留 `unmapped`，不因换季刷新推断 operation 或伤害分面。

S4 原表 `DT_GPMGESkillDesConfigTable_Main` 的 `1013039001_1.MGEDescription` 含 `{GPModifier:121300390:BaseValue:0:13}`，Modifier 表没有该 ID；同 ID 的 `numerical_config_equip` 伤害行不能作为替代。原表审计对这个精确 Token 报已知缺失警告，不推断或发布数值；今后 Token 得以解析时必须移除例外。

## 属性语义目录

`data/num-modifier-semantics.json` 为每个 Lock 属性显式登记一种 disposition：

- `indexed`：进入规范属性类型和来源索引；
- `known-unindexed`：已识别但尚不发布索引，必须说明理由；
- `unmapped`：描述表缺失或语义未审定，允许锁定但不生成分面；
- `invalid`：仅允许精确行 allowlist 的源数据异常。

新版本出现未登记属性时 `pnpm num-modifier:check` 直接失败。属性类型回答“修改了什么”，效果方向回答“相对正向轴如何变化”，索引分面回答“玩家按什么查询”；三者不得互相替代。例如移动速度降低生成“减速”分面，伤害抗性降低生成“易伤”分面。

当前 operation 边界和独弹强化精确例外以 [`../standards/num-modifier-semantics.md`](../standards/num-modifier-semantics.md) 为准。`B1` 可按符号解析方向；`B5` 只确认乘法家族，方向和增量换算保持未知；其他 operation 除精确 `reviewed_semantics` 外不推导方向。`Attack + B5` 可以保留已知伤害通道，但投影方向仍是 `unknown`。

## Resolver 接口

`lib/num-modifier.ts` 对外提供：

```ts
getRow(key, referencePath?)
getRowsById(mode, modifierId)
resolveValue(expression, format, referencePath?)
resolveTemplate(description, bindings, referencePath?)
resolveGameModifierTokens(description, referencePath?)
describeAttribute(attributeName, referencePath?)
resolveEffect(expression, context?, referencePath?)
```

`describeAttribute()` 只返回规范属性事实。`resolveEffect()` 结合表达式、operation 和接收者生成值、operation 模型、方向、作用范围和零到多个分面；调用者不得按字段后缀、描述关键词或正负号重新分类。

表达式只允许 `field: base | coefficient` 和正数 `scale`。格式只允许 `number`、`percent`、`signed-number`、`signed-percent`，并校验与属性 quantity 的兼容性。缺行、非法字段、非正 scale、未知模板别名、未登记属性和精确例外漂移都直接失败并携带消费者路径。

## 来源与投影

`data/modifier-providers.json` 是全部 197 个 Modifier 来源和 334 个排除项的服务端唯一事实。直接来源保存：

```yaml
applications:
  - expression:
      row: "lc:111010083_1_0"
      field: base
    context:
      recipient: self
```

有 Num 表达式的来源由 Resolver 派生分类。只有无法直连 Num 的来源使用 `reviewed-override`，显式保存分面和依据。`data/modifier-index-runtime.json` 提供按来源、属性类型、方向、分面和接收者查询的通用轻量投影；`lib/modifier-index.ts` 是客户端接口。

`data/guides/multiplier-providers-runtime.json` 从通用投影筛选伤害分面生成，继续维持 `lib/multiplier-data.ts` 的既有查询与 URL。乘区矩阵只拥有 `facetId -> factor -> damage applicability`，不再拥有 `AttributeName` 映射。

运行时投影不保存输入文件哈希。新鲜度校验重新生成投影并比较实际发布数据；只修改审计备注、未被消费的字段或 JSON 格式不会使索引过期。来源身份、分面、接收者或展示数据发生变化仍须重新生成。原表 Lock 和独立证据快照的来源哈希继续用于审计。

## 消费者

Num 技能扩展见 [`../standards/weapon-skills.md`](../standards/weapon-skills.md)：全部武器以稳定技能身份关联参数与 Modifier 来源；插件以显式替换边指向版本隔离的技能变体。它复用已有充能 Lock 与 Modifier Resolver，不改变 Modifier operation 的含义。`num-modifier:check` 同时校验技能覆盖和双向索引。

- 插件 `effect_values` 不再手写 `kind`、`statId` 或 `modifierTypeId`；Num stages 从 `resolveEffect()` 派生分类和默认标签。
- 无 Num 行的 literal stage 继续要求 `{ literal, reason }`，并在 effect 上显式声明 `semantic.facetId`。
- 描述模板继续使用 `{{num:alias|format}}`；插件详情、预览、召唤物和攻略编辑器消费 `lib/perks.ts` 的解析结果。
- 超限在维护阶段使用 V2 解析审定效果，发布投影保存在 `data/overlimit/current.json`；运行时不再通过 ItemID 合并当前插件。页面、搜索和站图使用统一目录入口，缺失模块不继承旧赛季。归档及切换见 [`../workflows/overlimit-season.md`](../workflows/overlimit-season.md)。
- 状态效果保留 `modifierIds` 身份，由 Resolver 生成规范技术详情、减速、易伤、减伤和乘区关系；关键词只在没有结构化 Modifier 效果时回退。
- 原始 `{GPModifier:...}` Token、乘区审计和超限审计统一通过 Resolver 读取 Lock。

## 命令与边界

```bash
pnpm num-modifier:lock     # 从 refs 刷新两张源表并重建投影
pnpm num-modifier:project  # 从已提交 Lock、语义和来源目录重建投影
pnpm num-modifier:check    # 离线检查完整性、语义、消费者、投影和静态边界
pnpm num-modifier:audit    # 要求 refs，核对源表、哈希、连接和游戏 Token
```

`dev` 和 `build` 固定执行离线检查。业务代码不得引用两张原表路径、直接导入完整 Lock、恢复旧乘区来源注册表，或在插件 frontmatter 重新手写机械分类。

# 召唤物篇章维护

召唤物篇章使用“人工确认的已提交数据锁 + 现有公开数据消费者”。页面和构建运行时不得读取 `refs/`。

## 数据链路

```text
游戏导出证据 + 已发布武器 / S3 天赋
  → 人工核对召唤、Actor、AI 行为、Numerical 与 Buff 链
  → data/summons.json + data/summon-damage-lock.json
  → lib/summons.ts
  → components/SummonCompendium*.tsx
  → data/posts/summons.mdx
  → 文章归档 / 全局搜索 / sitemap
```

`lib/summons.ts` 会在服务端继续联查：

- `data/weapon-data-lock.json`：已发布武器召唤伤害；
- `data/summon-damage-lock.json`：武器锁未收录的炮台与赛季仆从 Numerical 伤害行；
- `data/status-effects.json`：Buff 名称、持续时间、叠层与乘区；
- `data/perks/slot-*/*.mdx`：只接受 `CollectMODItem: 1` 的插件；
- `data/season-talents/s3/*.json`：只接受站内已发布 S3 天赋；
- `data/guides/multiplier.json` 与 provider registry：伤害适用乘区和来源乘区。

## 收录边界

收录对象必须至少有一条可追踪链证明它会生成独立 Actor、可放置装置、后台武器实体或赛季仆从。只生成投射物的追踪弹、没有当前投放链的权重 0 哨卫、未添加的 S0/S1/S2 天赋不进入主图鉴。

每个对象必须明确：

1. 召唤方式、数量、生命周期、操控与索敌；
2. 每条伤害的系数、结算类型、元素、暴击和弱点许可；
3. 连续攻击的间隔与 RPM，或动作 AI 的动作周期与技能冷却；
4. Buff、上线插件、S3 天赋与乘区链接；
5. 文案、默认字段和执行链冲突时采用的证据与不确定项。

同一召唤物的插件存在槽位互斥时，使用 `perkSelectionNote` 明确槽位和二选一规则；不能把互斥插件写成可同时生效的组合。

不要用视觉效果推断元素，也不要把 `LaserSpawnTime`、动画命中点或蓝图内部当前变量直接当成射速。没有完整证据时显示“待实测”。

## 伤害与乘区

图鉴中的单次白值统一使用 `系数 × 猎场基准攻击 500` 计算，作为不同召唤物之间的快速比较值；原始攻击力系数显示在白值下方。武器型召唤从 `weapon-data-lock.json` 解析系数，其余条目通过 `summons.json` 的 `lockSource` 索引 `summon-damage-lock.json`；页面配置不得直接写系数或白值。多段攻击在伤害锁中保留全部 Numerical 源行，运行时求和。该白值不包含实战中的攻击力成长、乘区、暴击、弱点和目标减伤，不等于最终实战伤害。

“适用乘区”只表示该 Settlement 能受该类修正影响，不证明召唤 Actor 已继承玩家的全部属性。属性桥、独立原型或运行时覆盖证据必须单独记录。

暴击和弱点许可在伤害行独立展示，不重复塞进乘区徽标；徽标主要索引大稀释、元素、模式修正和易伤等机制。

## 校验

切换包体后，用显式 Content 路径刷新既有召唤伤害引用：

```bash
pnpm exec tsx scripts/summons/refresh-damage-lock.ts --content-root refs/Exports/NZM/Content
pnpm exec tsx --test scripts/summons/refresh-damage-lock.test.ts
```

刷新器读取每项 `sourceTable` 中的 `id/level`，更新系数、元素、暴击、弱点及 Health 结算。`attackStat` 是已审计的 Actor 语义，保留人工结论；不会从 `SkillDamage` 推断技能攻击力。缺行、未知枚举、非零固定伤害或多段结算字段冲突会中止写入，需重新审计条目。

```bash
pnpm test:summons
```

派生数据同步使用 `pnpm sync`；代码及发布验证按 [AGENTS.md](../../AGENTS.md#验证策略) 选择，不固定追加全量 lint，也不在 build 前重复生成搜索索引。

测试会检查稳定 ID、伤害引用、射速、Buff/插件/天赋引用、公开图标、搜索深链和 `refs/` 运行时边界。新增召唤物后还要在 375px、768px、1024px 与桌面宽度检查卡片密度、折叠详情、键盘焦点和横向溢出。

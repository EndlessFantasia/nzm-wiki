# 武器涂装同步

> 状态：active

武器详情页的「涂装」区块读取已提交的 `data/weapon-skins.json` 和 `public/icons/weapon-skins/` 图标，页面运行时不读取 `refs/`。

## 身份链

```text
data/weapons/<slug>.mdx prototype_id
  -> WeaponSkinConnect 中 WeaponVisualSkinType = 0 的原皮行（WeaponSkinPrototypeID 相同）
  -> 同 ItemID 的其他行（涂装）
  -> CommonItemDataTable[WeaponSkinItemID]：Name、Quality、Access、Description、NarrativeDesc、CommonTagIDs、NormalIcon
  -> TagInfo[CommonTagIDs]：典藏、联动系列等标签
```

- `Quality` 2/3/4 对应稀有/史诗/传说，与武器 resolver 一致。
- `WeaponVisualSkinType` ≥ 2 记为特殊外观，排序靠前；含义按数据推断，未找到官方定义。

## 上线判定

游戏表没有显式的上线字段。脚本只发布同时满足以下条件的涂装：

1. CommonItem 存在，名称不含「占位符」「绑定」；
2. `Access` 获取途径非空；
3. NormalIcon 已导出为 PNG。

原皮不受第 2 条限制，排在列表第一位；没有任何可发布涂装的武器不输出，原皮也不单独展示。被跳过的条目及原因写入 `MD/_local/weapon-skins/report.json`。缺少 `Access` 的条目可能已上线也可能未上线，需要人工核实后再调整规则。

## 命令

```text
pnpm weapon-skins:check   # 校验已提交产物与 refs 一致，不写文件
pnpm weapon-skins:write   # 重新生成 JSON、PNG 与 WebP，并删除不再发布的图标
```

`public/icons/weapon-skins/` 与 `public/webp/icons/weapon-skins/` 由脚本独占维护，不要手工放入其他文件。

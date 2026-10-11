# 逆战未来 Wiki

[逆战未来](https://nzm.qq.com/) 的非官方资料站，覆盖武器数据、插件效果、塔防图鉴等内容。

> Fork自 [qiekn/nzm-wiki](https://github.com/qiekn/nzm-wiki)，原作者 [@qiekn](https://github.com/qiekn) 保留版权。原项目更新节奏较慢且部分枪械数据不够清晰，于是分叉出来按自己的需求调整。

在线访问：[逆战未来维基](https://lostlightll.github.io/nzm-wiki)

## 技术栈

Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + MDX 

## 项目结构

```text
app/          Next.js 路由与页面
components/   MDX 组件、卡片、计算器和全局工具
data/         MDX 内容数据与部分 JSON 数据
lib/          数据读取、转换、计算和路径工具
public/       图片、图标、视频与静态生成文件
scripts/      构建、搜索索引、sitemap、数据提取脚本
types/        共享 TypeScript 类型
refs/         解包或外部参考数据
```

## 内容维护

内容主要写在 `data/` 目录下：

- `data/weapons/`：猎场武器
- `data/weapons_td/`：塔防武器
- `data/traps/`：塔防陷阱
- `data/posts/`：机制说明与攻略文章

图片路径需要通过 `getAssetPath()` 处理，避免 GitHub Pages 或其他带 `basePath` 的部署环境路径失效。

## 本地开发

```bash
pnpm i
pnpm dev        # 校验、生成搜索索引，再启动 http://localhost:3000
pnpm sync       # 编辑内容后一次更新索引并校验，不启动服务
pnpm build      # 生产构建
```

`pnpm sync` 更新超限关联、属性/乘区与技能索引、搜索索引、武器统计和站点地图，并校验相关内容。任一步失败都会停止并显示对应命令。它只使用本地站点内容和已提交的数值 Lock，不导入游戏原表、不刷新 Lock、不重新发布预览。完整流程见 [日常内容同步](docs/workflows/content-sync.md)。

## 免责声明

- 本站为非官方资料站，与腾讯及《逆战未来》开发组无从属关系。
- 游戏名称、图标、素材与相关数据版权归其权利方所有。

## 致谢名单

完整致谢请查看 [致谢页面](https://lostlightll.github.io/nzm-wiki/credits)。

- [@qiekn](https://github.com/qiekn) — 原始项目 [nzm-wiki](https://github.com/qiekn/nzm-wiki)，本项目 Fork 自此
- [@Sh4ck1e](https://github.com/Sh4ck1e) — 项目维护者
- [抖音 阿秋](https://www.douyin.com/user/MS4wLjABAAAAuR82F-F_U4ywRmTAAMtc5ssvsFdhZn62EF4f7YWJe1M) — 游戏内实测数据
- [B站 乐意如多](https://space.bilibili.com/52220706)
- [B站 正人君执](https://space.bilibili.com/15114153)
- [B站 小小米河](https://space.bilibili.com/3546669903775781)

## 许可

MIT License

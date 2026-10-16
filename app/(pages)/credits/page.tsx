import type { Metadata } from "next";
import { CreditsPage } from "@/components/CreditsPage";
import { getAssetPath } from "@/lib/path";

export const metadata: Metadata = {
  title: "致谢",
  description: "感谢为逆战未来 Wiki 做出贡献的每一位玩家和创作者",
  alternates: { canonical: "/credits" },
};

// Tier 1 核心致谢数据（不含头像 URL，由服务端 fetch）
const CORE_CONTRIBUTORS = [
  {
    name: "幻想延续",
    platform: "github" as const,
    url: "https://github.com/lostlightll",
    description: "本项目维护者",
    githubUser: "lostlightll",
    extraLink: "https://github.com/lostlightll",
    extraLabel: "个人主页",
  },
  {
    name: "Sh4ck1e",
    platform: "github" as const,
    url: "https://github.com/Sh4ck1e",
    description: "本项目维护者",
    githubUser: "Sh4ck1e",
  },
  {
    name: "qiekn",
    platform: "github" as const,
    url: "https://github.com/qiekn",
    description: "原始项目 nzm-wiki，本项目 Fork 自此",
    githubUser: "qiekn",
  },
  {
    name: "长夜白",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/37696843",
    description: "只剩格调",
    avatarUrl: getAssetPath("/avatars/changyebai.webp"),
    golden: true,
  },
  {
    name: "宅D博士",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/85306978",
    description: "铁砧教主",
    avatarUrl: getAssetPath("/avatars/zhaiddr.webp"),
  },
  {
    name: "阿秋",
    platform: "douyin" as const,
    url: "https://www.douyin.com/user/MS4wLjABAAAAuR82F-F_U4ywRmTAAMtc5ssvsFdhZn62EF4f7YWJe1M",
    description: "游戏内实测数据",
    avatarUrl: getAssetPath("/avatars/aqiu.webp"),
  },
  {
    name: "乐意如多",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/52220706",
    description: "卡比兽！",
    avatarUrl: getAssetPath("/avatars/leruyiduo.webp"),
  },
  {
    name: "正人君执",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/15114153",
    description: "“毒攻略”博主",
    avatarUrl: getAssetPath("/avatars/zhengrenjunzhi.webp"),
  },
  {
    name: "小小米河",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/3546669903775781",
    description: "已打穿厕所",
    avatarUrl: getAssetPath("/avatars/xiaoxiaomihe.webp"),
  },
  {
    name: "布里布罗茨",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/503964339",
    description: "炎刃哥！",
    avatarUrl: getAssetPath("/avatars/bulibuluoci.webp"),
  },
  {
    name: "教父锦杰",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/3546379255286218",
    description: "骚包锦杰",
    avatarUrl: getAssetPath("/avatars/jiaofujinjie.webp"),
  },
  {
    name: "云梦殇之涧",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/52522505",
    description: "绝活哥！",
    avatarUrl: getAssetPath("/avatars/yunmengshangzhijian.webp"),
  },
  {
    name: "诺梦",
    platform: "bilibili" as const,
    url: "https://space.bilibili.com/501127825",
    description: "最好的外包 NZM BWiki维护者",
    avatarUrl: getAssetPath("/avatars/nuomeng.webp"),
  },
];

// Tier 2 内容致谢
const CONTENT_CONTRIBUTORS = [
  {
    platform: "bilibili" as const,
    author: "冷风影_",
    url: "https://space.bilibili.com/395952772",
    title: "很多塔防数据照搬了 UP 视频",
  },
  {
    platform: "bilibili" as const,
    author: "灬贝莉尔灬",
    url: "https://space.bilibili.com/11582430",
    title: "参考塔防数据实测视频",
  },
  {
    platform: "bilibili" as const,
    author: "南溪丶知忆",
    url: "https://space.bilibili.com/351648696",
    title: "收到了私信的塔防数据表格",
  },
  {
    platform: "bilibili" as const,
    author: "逆战奶黄包",
    url: "https://space.bilibili.com/1343476248",
    title: "Boss 攻略视频参考",
  },
  {
    platform: "bilibili" as const,
    author: "岭晴云",
    url: "https://space.bilibili.com/348855694",
    title: "Boss 机制与打法视频参考",
  },
  {
    platform: "bilibili" as const,
    author: "幻枫华羽",
    url: "https://www.bilibili.com/video/BV19Q6bBrE1m",
    title: "武器数据参考",
  },
  {
    platform: "bilibili" as const,
    author: "盒仔-逆战未来",
    url: "https://www.bilibili.com/video/BV1UkcAz5EBB",
    title: "武器评测视频参考",
  },
  {
    platform: "bilibili" as const,
    author: "木叶黑龙",
    url: "https://www.bilibili.com/video/BV1kbAczAEbf",
    title: "怪物技巧视频参考",
  },
  {
    platform: "bilibili" as const,
    author: "念念km",
    url: "https://www.bilibili.com/video/BV1ALFhzCE63",
    title: "谜题解析视频参考",
  },
  {
    platform: "tieba" as const,
    author: "晴天歌",
    url: "https://tieba.baidu.com/p/10487410042",
    title: "贴吧数据",
  },
  {
    platform: "github" as const,
    author: "yihegf",
    url: "https://github.com/qiekn/nzm-wiki/issues/1",
    title: "GitHub issue 反馈",
  },
  {
    platform: "github" as const,
    author: "Perpetual-Memories",
    url: "https://github.com/EndlessFantasia/nzm-wiki/issues/11",
    title: "GitHub issue 反馈",
  },
  {
    platform: "bilibili" as const,
    author: "逆战未来",
    url: "https://space.bilibili.com/6131035",
    title: "官方攻略视频",
  },
];

export default function CreditsPageServer() {
  // 注入头像 URL
  const coreContributors = CORE_CONTRIBUTORS.map((c) => {
    if ("avatarUrl" in c && c.avatarUrl) return c;
    let avatarUrl: string | null = null;
    let fallbackAvatarUrl: string | null = null;
    if (c.platform === "github" && c.githubUser) {
      avatarUrl = `https://github.com/${c.githubUser}.png`;
      fallbackAvatarUrl = getAssetPath(`/avatars/${c.githubUser}.webp`);
    }
    return { ...c, avatarUrl, fallbackAvatarUrl };
  });

  return (
    <CreditsPage
      coreContributors={coreContributors}
      contentContributors={CONTENT_CONTRIBUTORS}
    />
  );
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSiteNavigation,
  SITE_NAV_FOOTER_ITEM,
  SITE_NAV_SECTIONS,
} from "./site-navigation";

function active(pathname: string, hash = "") {
  return resolveSiteNavigation({ pathname, hash })?.activeItemId ?? null;
}

test("站点导航配置保持预期分组和顺序", () => {
  assert.deepEqual(
    SITE_NAV_SECTIONS.map((section) => ({
      label: section.label,
      items: section.items.map((item) => item.label),
    })),
    [
      { label: "图鉴", items: ["武器图鉴", "插件图鉴", "敌人图鉴"] },
      { label: "玩法", items: ["塔防图鉴", "超限图鉴", "原点图鉴", "生存战图鉴"] },
      {
        label: "攻略资料",
        items: ["游戏乘区", "赛季天赋", "搭配攻略", "攻略文章"],
      },
    ],
  );
  assert.equal(SITE_NAV_FOOTER_ITEM.label, "致谢");
});

test("首页和普通图鉴路由解析到正确入口", () => {
  assert.equal(resolveSiteNavigation({ pathname: "/" })?.itemLabel, "首页");
  assert.equal(active("/weapons"), "weapons");
  assert.equal(active("/weapons/example"), "weapons");
  assert.equal(active("/perks/example/detail"), "perks");
  assert.equal(active("/bosses/example"), "enemies");
  assert.equal(active("/enemies/lc/example"), "enemies");
  assert.equal(active("/overlimit/example"), "overlimit");
  assert.equal(active("/origin"), "origin");
  assert.equal(active("/origin/example"), "origin");
  assert.equal(active("/survival"), "survival");
  assert.equal(active("/credits/"), "credits");
});

test("塔防交叉路由优先归属塔防图鉴", () => {
  assert.equal(active("/tower-defense"), "tower-defense");
  assert.equal(active("/weapons/td/example"), "tower-defense");
  assert.equal(active("/traps/example"), "tower-defense");
  assert.equal(active("/enemies/td/example"), "tower-defense");
});

test("攻略模块通过路径和 hash 解析", () => {
  assert.equal(active("/multiplier"), "multiplier");
  assert.equal(active("/season-talents"), "season-talents");
  assert.equal(active("/builds"), "builds");
  assert.equal(active("/builds/example"), "builds");
  assert.equal(active("/posts"), "articles");
  assert.equal(active("/guides"), "multiplier");
  assert.equal(active("/guides", "#multiplier"), "multiplier");
  assert.equal(active("/guides", "#season-talents"), "season-talents");
  assert.equal(active("/guides/season-talents/s3/zero"), "season-talents");
  assert.equal(active("/guides", "#archive"), "articles");
  assert.equal(active("/posts/example"), "articles");
});

test("未归类的遗留页面不强行高亮", () => {
  assert.equal(resolveSiteNavigation({ pathname: "/damage" }), null);
  assert.equal(resolveSiteNavigation({ pathname: "/cards/example" }), null);
});

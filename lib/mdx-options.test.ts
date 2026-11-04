import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { mdxOptions } from "./mdx-options";

test("MDX retains the element table's array and object props", async () => {
  const { compileMDX } = await import("next-mdx-remote/rsc");
  const source = fs.readFileSync(path.join(process.cwd(), "data/posts/element.mdx"), "utf8");
  let receivedRows: unknown[] = [];
  const { content } = await compileMDX({
    source,
    options: mdxOptions,
    components: {
      DataTable: ({ data }: { data: unknown[] }) => {
        receivedRows = data;
        return null;
      },
      Callout: "aside",
    },
  });
  renderToStaticMarkup(content);
  assert.ok(Array.isArray(receivedRows), "MDX must preserve the DataTable data expression");
  assert.equal(receivedRows.length, 4);
  assert.deepEqual(receivedRows[0], {
    icon: "/icons/elements/fire.png",
    cells: ["火焰(灼烧)", 5, "每 **2** 秒承受 **10 × 层数** 的伤害", "每 **2** 秒衰减 **1** 层"],
  });
});

test("MDX blocks process access and function constructor access", async () => {
  const { compileMDX } = await import("next-mdx-remote/rsc");
  for (const source of ["{process.cwd()}", '{({}).constructor.constructor("return 1")()}']) {
    await assert.rejects(compileMDX({ source, options: mdxOptions }), /Security:/);
  }
});

test("MDX renders math with KaTeX", async () => {
  const { compileMDX } = await import("next-mdx-remote/rsc");
  const { content } = await compileMDX({ source: "Damage: $x^2$", options: mdxOptions });
  assert.match(renderToStaticMarkup(content), /class="katex"/);
});

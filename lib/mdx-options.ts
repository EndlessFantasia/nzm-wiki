import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export const mdxOptions = {
  // Repository MDX uses array/object props. Keep these while retaining v6's dangerous-JS checks.
  blockJS: false,
  blockDangerousJS: true,
  mdxOptions: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
};

import type { Metadata } from "next";
import { getMDXList } from "@/lib/mdx";
import { sortPostArchiveItems } from "@/lib/post-archive";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Post {
  slug: string;
  title?: string;
  tag?: string | string[];
}

function getAllTags(posts: Post[]): string[] {
  const tagSet = new Set<string>();
  posts.forEach((post) => {
    if (post.tag) {
      const tags = Array.isArray(post.tag) ? post.tag : [post.tag];
      tags.forEach((t) => tagSet.add(t));
    }
  });
  return Array.from(tagSet);
}

export async function generateStaticParams() {
  const posts = getMDXList("posts") as Post[];
  const tags = getAllTags(posts);
  return tags.map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  return {
    title: `标签：${decodedTag}`,
    description: `逆战未来攻略文章中标记为「${decodedTag}」的文章。`,
    alternates: { canonical: `/posts/tags/${encodeURIComponent(decodedTag)}` },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const allPosts = sortPostArchiveItems(getMDXList("posts") as Post[]);

  const filteredPosts = allPosts.filter((post) => {
    if (!post.tag) return false;
    const tags = Array.isArray(post.tag) ? post.tag : [post.tag];
    return tags.includes(decodedTag);
  });

  const renderTags = (postTag: string | string[] | undefined) => {
    if (!postTag) return null;
    const tags = Array.isArray(postTag) ? postTag : [postTag];
    return tags.map((t, i) => (
      <Link
        key={i}
        href={`/posts/tags/${encodeURIComponent(t)}`}
        className={`px-2 py-0.5 text-xs rounded transition-colors ${
          t === decodedTag
            ? "bg-blue-600 text-white"
            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
        }`}
      >
        {t}
      </Link>
    ));
  };

  return (
    <div className="mx-auto max-w-3xl p-10">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/posts"
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-2xl font-bold text-white">文章归档</span>
        </Link>
        <span className="text-zinc-600 text-xl">/</span>
        <span className="text-xl text-zinc-300">{decodedTag}</span>
        <span className="text-zinc-500 text-sm">({filteredPosts.length})</span>
      </div>
      <ul className="space-y-3">
        {filteredPosts.map((post) => (
          <li key={post.slug} className="flex items-center gap-2">
            {renderTags(post.tag)}
            <Link
              href={`/posts/${post.slug}`}
              className="text-zinc-300 hover:text-white transition-colors"
            >
              {post.title || post.slug}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

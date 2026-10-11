import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "内容编辑器",
  robots: { index: false, follow: false },
};

export default function EditorPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-background text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            内容编辑器
          </h1>
        </header>

        <nav aria-label="编辑器模块" className="mt-6">
          <Link
            href="/editor/builds"
            className="group flex min-h-20 items-center gap-4 border-b border-zinc-800 px-2 py-4 text-left transition-colors hover:border-[#d1ac69]/45 hover:bg-zinc-900/45 focus-visible:underline focus-visible:decoration-[#d1ac69] focus-visible:decoration-2 focus-visible:underline-offset-4 focus-visible:outline-none sm:px-4"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#d1ac69]/10 text-[#d1ac69]">
              <BookOpenText className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-white">
                搭配攻略
              </span>
              <span className="mt-1 block text-sm text-zinc-500">Build</span>
            </span>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-zinc-600 transition-colors group-hover:text-[#d1ac69]"
              aria-hidden="true"
            />
          </Link>
        </nav>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuildGuideEditor } from "@/components/build-guides/BuildGuideEditor";
import { getBuildGuideEditorData } from "@/lib/build-guide-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "搭配攻略编辑器",
  robots: { index: false, follow: false },
};

export default async function BuildGuideEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const requestedFile =
    typeof params.file === "string" ? decodeURIComponent(params.file) : undefined;
  const { catalog, document } = await getBuildGuideEditorData(requestedFile);
  return <BuildGuideEditor catalog={catalog} initialDocument={document} />;
}

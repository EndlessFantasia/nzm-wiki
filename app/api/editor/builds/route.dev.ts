import { NextResponse } from "next/server";
import { saveBuildGuideEditorDocument } from "@/lib/build-guide-editor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      slug?: unknown;
      originalFile?: unknown;
      source?: unknown;
      content?: unknown;
    };
    if (typeof body.slug !== "string") {
      throw new Error("文件名不能为空");
    }
    const saved = await saveBuildGuideEditorDocument({
      slug: body.slug,
      originalFile: body.originalFile,
      source: body.source,
      content: body.content,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 400 },
    );
  }
}

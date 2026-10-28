"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  ExternalLink,
  FilePlus2,
  Save,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatBuildGuideMdx } from "@/lib/build-guide-editor-format";
import type {
  BuildGuideEditorCatalog,
  BuildGuideEditorDocument,
  BuildGuideEditorPerkOption,
  BuildGuideEditorWeaponOption,
} from "@/lib/build-guide-editor";
import type {
  BuildGuideSource,
} from "@/lib/build-guides";
import { DESKTOP_BEFORE_AUTO_RELOAD_EVENT } from "@/lib/desktop";
import { getAssetPath } from "@/lib/path";
import { matchPinyin } from "@/lib/pinyin";

const BUILD_GUIDE_PERK_SLOTS = [1, 2, 3, 4] as const;
type BuildGuidePerkSlot = (typeof BUILD_GUIDE_PERK_SLOTS)[number];
type WeaponRole = keyof BuildGuideSource["weapons"];
type RangedWeaponRole = keyof BuildGuideSource["perks"];
type EditorTab = "content" | "mdx";

const INPUT_CLASS =
  "h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-600 focus-visible:border-[#d1ac69]";
const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm leading-6 text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-600 focus-visible:border-[#d1ac69]";
const BUTTON_FOCUS =
  "focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";

function plainDescription(value: string): string {
  return value.replace(/<[^>]*>/g, "").replaceAll("\n", " ");
}

function isPerkApplicable(
  perk: BuildGuideEditorPerkOption,
  weapon: BuildGuideEditorWeaponOption,
): boolean {
  if (perk.weaponNames.length > 0) {
    return perk.weaponNames.includes(weapon.title);
  }
  if (perk.weaponType.length > 0) {
    return (
      weapon.weaponTypeId !== undefined &&
      perk.weaponType.includes(weapon.weaponTypeId)
    );
  }
  return true;
}

function getCompatiblePerks(
  catalog: BuildGuideEditorCatalog,
  weapon: BuildGuideEditorWeaponOption,
  slot: BuildGuidePerkSlot,
): BuildGuideEditorPerkOption[] {
  return catalog.perks.filter(
    (perk) => perk.slot === slot && isPerkApplicable(perk, weapon),
  );
}

function makeDefaultPerkSet(): BuildGuideSource["perks"]["primary"] {
  return {
    "1": "",
    "2": "",
    "3": "",
    "4": "",
  };
}

function makeBlankDocument(catalog: BuildGuideEditorCatalog): BuildGuideEditorDocument {
  const primary = catalog.weapons.find((weapon) => weapon.useType === "主武器");
  const secondary = catalog.weapons.find((weapon) => weapon.useType === "副武器");
  const melee = catalog.weapons.find((weapon) => weapon.useType === "近战武器");
  if (!primary || !secondary || !melee) {
    throw new Error("攻略编辑器缺少可用武器");
  }
  return {
    file: "",
    slug: "s3-build",
    source: {
      title: "S3 搭配攻略",
      summary: "",
      source: "幻想延续",
      season: "s3",
      draft: true,
      tags: [],
      weapons: {
        primary: primary.slug,
        secondary: secondary.slug,
        melee: melee.slug,
      },
      perks: {
        primary: makeDefaultPerkSet(),
        secondary: makeDefaultPerkSet(),
      },
      talent: {
        tree: catalog.talentTrees[0]?.id ?? "zero",
        passive: catalog.passives[0]?.id ?? "",
        route: "11111",
      },
    },
    content: "## 手法教学\n\n",
  };
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface ImageSelectOption {
  value: string;
  label: string;
  image?: string;
}

function ImageSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  options: ImageSelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = query.trim()
    ? options.filter((option) => matchPinyin(option.label, query.trim()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}：${selected?.label ?? "未选择"}`}
        onClick={() => {
          setQuery("");
          setOpen((current) => !current);
        }}
        className={`${INPUT_CLASS} flex items-center justify-between gap-3 text-left ${BUTTON_FOCUS}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? "请选择"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          {options.length > 8 && (
            <label className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3">
              <Search className="h-4 w-4 shrink-0 text-zinc-600" />
              <span className="sr-only">搜索{label}</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`搜索${label}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>
          )}
          <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm ${BUTTON_FOCUS} ${
                  option.value === value
                    ? "bg-[#d1ac69]/15 text-[#e2c38b]"
                    : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span className="flex h-10 w-14 shrink-0 items-center justify-center">
                  {option.image ? (
                    <Image
                      src={getAssetPath(option.image)}
                      alt=""
                      width={56}
                      height={40}
                      className="h-10 w-14 object-contain"
                    />
                  ) : (
                    <span className="h-8 w-8 rounded bg-zinc-900" />
                  )}
                </span>
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-zinc-600">
                没有匹配项
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeaponIcon({ weapon }: { weapon: BuildGuideEditorWeaponOption }) {
  return (
    <Image
      src={getAssetPath(weapon.icon)}
      alt=""
      width={96}
      height={56}
      className="h-12 w-20 shrink-0 object-contain"
    />
  );
}

function PerkSelect({
  catalog,
  weapon,
  slot,
  value,
  onChange,
}: {
  catalog: BuildGuideEditorCatalog;
  weapon: BuildGuideEditorWeaponOption;
  slot: BuildGuidePerkSlot;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = getCompatiblePerks(catalog, weapon, slot);
  const selected = options.find((perk) => perk.slug === value);
  return (
    <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center">
        {selected?.icon ? (
          <Image
            src={getAssetPath(selected.icon)}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
        ) : (
          <span className="text-xs tabular-nums text-zinc-600">{slot}</span>
        )}
      </div>
      <ImageSelect
        label={`${slot} 号槽插件`}
        value={value}
        options={[
          { value: "", label: `${slot} · 无插件` },
          ...options.map((perk) => ({
            value: perk.slug,
            label: `${slot} · ${perk.name}`,
            image: perk.icon,
          })),
        ]}
        onChange={onChange}
      />
    </div>
  );
}

function LoadoutEditor({
  catalog,
  role,
  source,
  onWeaponChange,
  onPerkChange,
}: {
  catalog: BuildGuideEditorCatalog;
  role: RangedWeaponRole;
  source: BuildGuideSource;
  onWeaponChange: (role: WeaponRole, slug: string) => void;
  onPerkChange: (
    role: RangedWeaponRole,
    slot: BuildGuidePerkSlot,
    slug: string,
  ) => void;
}) {
  const useType = role === "primary" ? "主武器" : "副武器";
  const weapons = catalog.weapons.filter((weapon) => weapon.useType === useType);
  const weapon =
    weapons.find((option) => option.slug === source.weapons[role]) ?? weapons[0];
  if (!weapon) return null;

  return (
    <div className="min-w-0 py-4 first:pt-0 lg:py-0 lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <div className="mb-3 flex items-center gap-3">
        <WeaponIcon weapon={weapon} />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`weapon-${role}`}
            className="mb-1 block text-xs font-medium text-zinc-500"
          >
            {useType}
          </label>
          <ImageSelect
            id={`weapon-${role}`}
            label={useType}
            value={weapon.slug}
            onChange={(value) => onWeaponChange(role, value)}
            options={weapons.map((option) => ({
              value: option.slug,
              label: option.title,
              image: option.icon,
            }))}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {BUILD_GUIDE_PERK_SLOTS.map((slot) => (
          <PerkSelect
            key={slot}
            catalog={catalog}
            weapon={weapon}
            slot={slot}
            value={source.perks[role][String(slot) as "1" | "2" | "3" | "4"]}
            onChange={(slug) => onPerkChange(role, slot, slug)}
          />
        ))}
      </div>
    </div>
  );
}

function validateEditorState(slug: string, source: BuildGuideSource) {
  const errors: Record<string, string> = {};
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)) {
    errors.slug = "使用文字、数字和单个连字符，不要包含空格或路径符号";
  }
  if (!source.title.trim()) errors.title = "标题不能为空";
  if (!source.summary.trim()) errors.summary = "摘要不能为空";
  if (!source.source.trim()) errors.source = "来源不能为空";
  if (!/^[1-4]{5}$/.test(source.talent.route)) {
    errors.route = "路线必须包含五个 1–4 数字";
  }
  return errors;
}

export function BuildGuideEditor({
  catalog,
  initialDocument,
}: {
  catalog: BuildGuideEditorCatalog;
  initialDocument: BuildGuideEditorDocument;
}) {
  const [slug, setSlug] = useState(initialDocument.slug);
  const [source, setSource] = useState<BuildGuideSource>(initialDocument.source);
  const [content, setContent] = useState(initialDocument.content);
  const [tagsText, setTagsText] = useState(initialDocument.source.tags.join(", "));
  const [currentFile, setCurrentFile] = useState(initialDocument.file);
  const [availableFiles, setAvailableFiles] = useState(catalog.files);
  const [tab, setTab] = useState<EditorTab>("content");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const snapshot = JSON.stringify({ slug, source, content });
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot);
  const dirty = snapshot !== savedSnapshot;
  const generatedMdx = useMemo(
    () => formatBuildGuideMdx(source, content),
    [source, content],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    // 桌面端发现新部署时不自动重载有未保存编辑的页面
    const preventAutoReload = (event: Event) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener(DESKTOP_BEFORE_AUTO_RELOAD_EVENT, preventAutoReload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(DESKTOP_BEFORE_AUTO_RELOAD_EVENT, preventAutoReload);
    };
  }, [dirty]);

  const updateSource = <K extends keyof BuildGuideSource>(
    key: K,
    value: BuildGuideSource[K],
  ) => {
    setSource((current) => ({ ...current, [key]: value }));
    setStatus({ kind: "idle" });
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleWeaponChange = (role: WeaponRole, weaponSlug: string) => {
    const weapon = catalog.weapons.find((option) => option.slug === weaponSlug);
    if (!weapon) return;
    setSource((current) => {
      const weapons = { ...current.weapons, [role]: weaponSlug };
      if (role === "melee") return { ...current, weapons };
      const nextPerks = { ...current.perks[role] };
      for (const slot of BUILD_GUIDE_PERK_SLOTS) {
        const key = String(slot) as "1" | "2" | "3" | "4";
        const compatible = getCompatiblePerks(catalog, weapon, slot);
        if (
          nextPerks[key] &&
          !compatible.some((perk) => perk.slug === nextPerks[key])
        ) {
          nextPerks[key] = "";
        }
      }
      return {
        ...current,
        weapons,
        perks: { ...current.perks, [role]: nextPerks },
      };
    });
    setStatus({ kind: "idle" });
  };

  const handlePerkChange = (
    role: RangedWeaponRole,
    slot: BuildGuidePerkSlot,
    perkSlug: string,
  ) => {
    const key = String(slot) as "1" | "2" | "3" | "4";
    setSource((current) => ({
      ...current,
      perks: {
        ...current.perks,
        [role]: { ...current.perks[role], [key]: perkSlug },
      },
    }));
    setStatus({ kind: "idle" });
  };

  const handleNew = () => {
    if (dirty && !window.confirm("当前修改尚未保存，确定新建攻略吗？")) return;
    const blank = makeBlankDocument(catalog);
    setSlug(blank.slug);
    setSource(blank.source);
    setContent(blank.content);
    setTagsText("");
    setCurrentFile("");
    setSavedSnapshot(
      JSON.stringify({
        slug: blank.slug,
        source: blank.source,
        content: blank.content,
      }),
    );
    setErrors({});
    setStatus({ kind: "idle" });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedMdx);
      setStatus({ kind: "success", message: "MDX 已复制" });
    } catch {
      setStatus({ kind: "error", message: "复制失败，请在 MDX 视图中手动复制" });
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateEditorState(slug, source);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus({ kind: "error", message: "请修正标记的字段后再保存" });
      return;
    }

    setStatus({ kind: "saving" });
    try {
      const response = await fetch(getAssetPath("/api/editor/builds"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          originalFile: currentFile || undefined,
          source,
          content,
        }),
      });
      const result = (await response.json()) as {
        file?: string;
        slug?: string;
        error?: string;
      };
      if (!response.ok || !result.file) {
        throw new Error(result.error ?? "保存失败");
      }
      setCurrentFile(result.file);
      setAvailableFiles((current) =>
        [
          ...current.filter(
            (file) => file !== currentFile && file !== result.file,
          ),
          result.file as string,
        ].sort((left, right) => left.localeCompare(right, "zh-CN")),
      );
      setSavedSnapshot(snapshot);
      setStatus({ kind: "success", message: `已保存 ${result.file}` });
      const nextUrl = getAssetPath(
        `/editor/builds?file=${encodeURIComponent(result.file)}`,
      );
      window.history.replaceState({}, "", nextUrl);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "保存失败",
      });
    }
  };

  const meleeWeapons = catalog.weapons.filter(
    (weapon) => weapon.useType === "近战武器",
  );
  const meleeWeapon =
    meleeWeapons.find((weapon) => weapon.slug === source.weapons.melee) ??
    meleeWeapons[0];
  const selectedTree = catalog.talentTrees.find(
    (tree) => tree.id === source.talent.tree,
  );
  const selectedPassive = catalog.passives.find(
    (passive) => passive.id === source.talent.passive,
  );

  return (
    <div className="min-h-[calc(100dvh-var(--site-header-height))] bg-background text-zinc-100">
      <form onSubmit={handleSave}>
        <header className="sticky top-(--site-header-height) z-30 border-b border-zinc-800 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
            <a
              href={getAssetPath("/editor")}
              aria-label="返回内容编辑器"
              title="返回内容编辑器"
              className={`flex h-11 w-11 shrink-0 items-center justify-center text-zinc-400 hover:text-white ${BUTTON_FOCUS}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div className="mr-auto min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-white sm:text-lg">
                  攻略编辑器
                </h1>
                {dirty && (
                  <span className="text-xs text-[#d1ac69]">未保存</span>
                )}
              </div>
              <p className="truncate text-xs text-zinc-500">
                {currentFile || "新攻略"}
              </p>
            </div>
            <label className="order-3 min-w-0 flex-1 sm:order-none sm:max-w-64">
              <span className="sr-only">切换攻略文件</span>
              <select
                value={currentFile}
                onChange={(event) => {
                  if (dirty && !window.confirm("当前修改尚未保存，确定切换文件吗？")) {
                    event.currentTarget.value = currentFile;
                    return;
                  }
                  window.location.href = getAssetPath(
                    `/editor/builds?file=${encodeURIComponent(event.target.value)}`,
                  );
                }}
                className={INPUT_CLASS}
              >
                {!currentFile && <option value="">新攻略</option>}
                {availableFiles.map((file) => (
                  <option key={file} value={file}>
                    {file.replace(/^builds\//, "").replace(/\.mdx$/, "")}
                  </option>
                ))}
              </select>
            </label>
            <div className="order-2 ml-auto flex items-center gap-1 sm:order-none sm:ml-0">
              <button
                type="button"
                onClick={handleNew}
                title="新建攻略"
                className={`flex h-11 items-center gap-2 px-3 text-sm text-zinc-400 hover:text-white ${BUTTON_FOCUS}`}
              >
                <FilePlus2 className="h-4 w-4" />
                <span className="hidden sm:inline">新建</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="复制 MDX"
                className={`flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white ${BUTTON_FOCUS}`}
              >
                <Clipboard className="h-4 w-4" />
              </button>
              <a
                href={getAssetPath(`/builds/${encodeURIComponent(slug)}`)}
                target="_blank"
                rel="noreferrer"
                title="打开攻略"
                aria-label="打开攻略"
                className={`flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white ${BUTTON_FOCUS}`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="submit"
                disabled={status.kind === "saving"}
                className={`flex h-11 items-center gap-2 rounded-md border border-[#d1ac69]/55 bg-[#d1ac69]/15 px-4 text-sm font-semibold text-[#e2c38b] hover:bg-[#d1ac69]/20 disabled:cursor-wait disabled:opacity-60 ${BUTTON_FOCUS}`}
              >
                {status.kind === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {status.kind === "saving" ? "保存中" : "保存"}
              </button>
            </div>
          </div>
          {status.kind !== "idle" && status.kind !== "saving" && (
            <div
              role={status.kind === "error" ? "alert" : "status"}
              className={`mx-auto max-w-[1600px] px-4 pb-2 text-xs sm:px-6 xl:px-8 ${
                status.kind === "error" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {status.message}
            </div>
          )}
        </header>

        <div className="mx-auto grid max-w-[1600px] gap-0 px-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_28rem] xl:px-8">
          <main className="min-w-0 xl:pr-8">
            <section className="border-b border-zinc-800 py-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-zinc-200">基础信息</h2>
                <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={source.draft}
                    onChange={(event) => updateSource("draft", event.target.checked)}
                    className="h-4 w-4 accent-[#d1ac69]"
                  />
                  草稿
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="guide-slug" label="文件名" error={errors.slug}>
                  <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-950 focus-within:border-[#d1ac69]">
                    <span className="pl-3 text-xs text-zinc-600">builds/</span>
                    <input
                      id="guide-slug"
                      value={slug}
                      onChange={(event) => {
                        setSlug(event.target.value);
                        setErrors((current) => ({ ...current, slug: "" }));
                        setStatus({ kind: "idle" });
                      }}
                      className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-zinc-100 outline-none"
                    />
                    <span className="pr-3 text-xs text-zinc-600">.mdx</span>
                  </div>
                </Field>
                <Field id="guide-source" label="搭配来源" error={errors.source}>
                  <input
                    id="guide-source"
                    value={source.source}
                    onChange={(event) => updateSource("source", event.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field id="guide-title" label="标题" error={errors.title}>
                  <input
                    id="guide-title"
                    value={source.title}
                    onChange={(event) => updateSource("title", event.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field id="guide-tags" label="标签">
                  <input
                    id="guide-tags"
                    value={tagsText}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTagsText(value);
                      updateSource(
                        "tags",
                        value
                          .split(/[,，]/)
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      );
                    }}
                    className={INPUT_CLASS}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="guide-summary" label="缩略摘要" error={errors.summary}>
                    <input
                      id="guide-summary"
                      value={source.summary}
                      onChange={(event) => updateSource("summary", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="border-b border-zinc-800 py-6">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">
                武器与插件
              </h2>
              <div className="divide-y divide-zinc-800 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                <LoadoutEditor
                  catalog={catalog}
                  role="primary"
                  source={source}
                  onWeaponChange={handleWeaponChange}
                  onPerkChange={handlePerkChange}
                />
                <LoadoutEditor
                  catalog={catalog}
                  role="secondary"
                  source={source}
                  onWeaponChange={handleWeaponChange}
                  onPerkChange={handlePerkChange}
                />
              </div>
              {meleeWeapon && (
                <div className="mt-4 flex items-center gap-3 border-t border-zinc-800 pt-4">
                  <WeaponIcon weapon={meleeWeapon} />
                  <div className="min-w-0 flex-1">
                    <Field id="weapon-melee" label="近战武器">
                      <ImageSelect
                        id="weapon-melee"
                        label="近战武器"
                        value={meleeWeapon.slug}
                        onChange={(value) => handleWeaponChange("melee", value)}
                        options={meleeWeapons.map((weapon) => ({
                          value: weapon.slug,
                          label: weapon.title,
                          image: weapon.icon,
                        }))}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </section>

            <section className="py-6">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">S3 天赋</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {catalog.talentTrees.map((tree) => {
                  const selected = source.talent.tree === tree.id;
                  return (
                    <button
                      key={tree.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        updateSource("talent", { ...source.talent, tree: tree.id })
                      }
                      className={`flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${BUTTON_FOCUS} ${
                        selected
                          ? "border-[#d1ac69]/65 bg-[#d1ac69]/10 text-white"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <Image
                        src={getAssetPath(tree.icon)}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 object-contain"
                      />
                      <span className="text-sm font-medium">{tree.name}</span>
                    </button>
                  );
                })}
              </div>
              {selectedTree && (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {plainDescription(selectedTree.description)}
                </p>
              )}

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
                <div className="flex min-w-0 items-center gap-3">
                  {selectedPassive && (
                    <Image
                      src={getAssetPath(selectedPassive.icon)}
                      alt=""
                      width={52}
                      height={52}
                      className="h-13 w-13 shrink-0 object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Field id="talent-passive" label="被动天赋卡">
                      <ImageSelect
                        id="talent-passive"
                        label="被动天赋卡"
                        value={source.talent.passive}
                        onChange={(value) =>
                          updateSource("talent", {
                            ...source.talent,
                            passive: value,
                          })
                        }
                        options={catalog.passives.map((passive) => ({
                          value: passive.id,
                          label: passive.name,
                          image: passive.icon,
                        }))}
                      />
                    </Field>
                  </div>
                </div>
                <Field id="talent-route" label="路线码" error={errors.route}>
                  <input
                    id="talent-route"
                    inputMode="numeric"
                    maxLength={5}
                    value={source.talent.route}
                    onChange={(event) =>
                      updateSource("talent", {
                        ...source.talent,
                        route: event.target.value.replace(/[^1-4]/g, ""),
                      })
                    }
                    className={`${INPUT_CLASS} font-mono font-semibold tabular-nums text-[#e2c38b]`}
                  />
                </Field>
              </div>
              {selectedPassive && (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {plainDescription(selectedPassive.description)}
                </p>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-5">
                {catalog.routeStages.map((stage, index) => {
                  const selected = stage.options.find(
                    (option) => option.value === source.talent.route[index],
                  );
                  return (
                    <div key={stage.phase} className="min-w-0 border-t border-zinc-800 pt-3">
                      <div className="mb-2 flex items-center gap-2">
                        {selected && (
                          <Image
                            src={getAssetPath(selected.icon)}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 object-contain"
                          />
                        )}
                        <span className="text-xs text-zinc-500">第 {index + 1} 阶段</span>
                      </div>
                      <ImageSelect
                        label={`第 ${index + 1} 阶段路线`}
                        value={source.talent.route[index] ?? "1"}
                        onChange={(value) => {
                          const route = source.talent.route.padEnd(5, "1").split("");
                          route[index] = value;
                          updateSource("talent", {
                            ...source.talent,
                            route: route.join(""),
                          });
                        }}
                        options={stage.options.map((option) => ({
                          value: option.value,
                          label: `${option.value} · ${option.name}`,
                          image: option.icon,
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          <aside className="min-w-0 border-t border-zinc-800 py-6 xl:border-l xl:border-t-0 xl:pl-8">
            <div className="xl:sticky xl:top-32">
              <div className="mb-4 flex h-11 border-b border-zinc-800" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "content"}
                  onClick={() => setTab("content")}
                  className={`flex-1 text-sm font-medium ${BUTTON_FOCUS} ${
                    tab === "content"
                      ? "border-b border-[#d1ac69] text-[#e2c38b]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  正文
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "mdx"}
                  onClick={() => setTab("mdx")}
                  className={`flex-1 text-sm font-medium ${BUTTON_FOCUS} ${
                    tab === "mdx"
                      ? "border-b border-[#d1ac69] text-[#e2c38b]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  MDX
                </button>
              </div>
              {tab === "content" ? (
                <textarea
                  aria-label="攻略正文"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setStatus({ kind: "idle" });
                  }}
                  spellCheck={false}
                  className={`${TEXTAREA_CLASS} min-h-[34rem] font-mono`}
                />
              ) : (
                <pre className="max-h-[calc(100dvh-10rem)] min-h-[34rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-400">
                  {generatedMdx}
                </pre>
              )}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

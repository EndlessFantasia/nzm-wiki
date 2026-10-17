import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";
import {
  TRIGGER_DAMAGE_GROUPS,
  type TriggerDamageEntry,
  type TriggerDamageGroup,
  type TriggerDamagePermission,
} from "@/lib/trigger-damage";

const ELEMENT_ICONS: Record<string, string> = {
  物理: "/icons/elements/kinetic.png",
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
};

function formatPermission(
  value: TriggerDamagePermission | null,
  enabledLabel: string,
  disabledLabel: string,
) {
  if (value === null) return "未确认";
  if (typeof value === "string") return value;
  return value ? enabledLabel : disabledLabel;
}

function formatWeakpointMultiplier(entry: TriggerDamageEntry) {
  if (entry.weakpoint === null || entry.weakpointMultiplier === null) {
    return "未确认";
  }
  if (entry.weakpoint === false || entry.weakpoint === "不适用") return "-";
  if (entry.weakpointMultiplier === undefined) return "-";
  return typeof entry.weakpointMultiplier === "number"
    ? `${entry.weakpointMultiplier}×`
    : entry.weakpointMultiplier;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-5 text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm leading-5 text-zinc-100 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function ElementValue({ element }: { element: string }) {
  const icon = ELEMENT_ICONS[element];
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon && (
        <Image
          src={getAssetPath(icon)}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0"
        />
      )}
      <span>{element}</span>
    </span>
  );
}

function TriggerDamageEntryContent({
  entry,
  detail = false,
}: {
  entry: TriggerDamageEntry;
  detail?: boolean;
}) {
  return (
    <>
      <header
        className={`grid min-w-0 gap-2 lg:items-baseline lg:gap-4 ${
          detail
            ? "lg:grid-cols-[8rem_minmax(0,1fr)_20rem] xl:grid-cols-7 xl:gap-x-5"
            : "lg:grid-cols-[10rem_minmax(0,1fr)_20rem]"
        }`}
      >
        {detail ? (
          <h2 className="min-w-0 text-base font-semibold leading-6 text-zinc-100 xl:col-span-1 xl:text-sm">
            独立伤害数值
          </h2>
        ) : (
          <h3 className="min-w-0 text-base font-semibold leading-6 text-zinc-100">
            {entry.href ? (
              <Link
                href={entry.href}
                className="break-words text-zinc-100 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                {entry.name}
              </Link>
            ) : (
              entry.name
            )}
          </h3>
        )}
        <p
          className={`min-w-0 text-sm leading-6 text-zinc-300 ${detail ? "xl:col-span-3" : ""}`}
        >
          {entry.trigger}
        </p>
        <dl
          className={`flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-zinc-500 lg:justify-end ${detail ? "xl:col-span-3" : ""}`}
        >
          <div className="flex gap-1.5">
            <dt>冷却/间隔</dt>
            <dd className="text-zinc-300">{entry.interval}</dd>
          </div>
        </dl>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-800 pt-3 sm:grid-cols-4 xl:grid-cols-7 xl:gap-x-5">
        <Stat label="伤害类型" value={entry.damageType} />
        <Stat label="伤害数值" value={entry.damageValue} />
        <Stat label="破韧值" value={String(entry.toughness)} />
        <Stat label="元素" value={<ElementValue element={entry.element} />} />
        <Stat
          label="暴击"
          value={formatPermission(entry.critical, "可暴击", "不可暴击")}
        />
        <Stat
          label="弱点"
          value={formatPermission(entry.weakpoint, "可弱点", "不可弱点")}
        />
        <Stat label="弱点倍率" value={formatWeakpointMultiplier(entry)} />
      </dl>

      {entry.note && (
        <p className="mt-3 border-l-2 border-zinc-600 pl-3 text-xs leading-5 text-zinc-400">
          {entry.note}
        </p>
      )}
      {entry.pending && (
        <p className="mt-3 border-l-2 border-amber-400/50 pl-3 text-xs leading-5 text-amber-200/80">
          待核验：{entry.pending}
        </p>
      )}
    </>
  );
}

const ROW_GRID =
  "md:grid md:grid-cols-[minmax(7.5rem,0.9fr)_minmax(10rem,1.6fr)_6.5rem_8.5rem_5.5rem_5rem_5.5rem_3.5rem] md:items-center md:gap-x-4";

function PendingBadge({ reason }: { reason: string }) {
  return (
    <span
      title={reason}
      className="ml-1.5 inline-flex shrink-0 items-center rounded border border-amber-400/40 px-1 py-px text-[11px] font-normal leading-4 text-amber-200/90"
    >
      待核验
    </span>
  );
}

function EntryName({ entry, group }: { entry: TriggerDamageEntry; group: TriggerDamageGroup }) {
  const linkClass =
    "text-zinc-100 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-y-1">
      <h3 className="text-sm font-semibold leading-6">
        {entry.href ? (
          <Link href={entry.href} className={linkClass}>
            {entry.name}
          </Link>
        ) : (
          <span className="text-zinc-100">{entry.name}</span>
        )}
      </h3>
      {entry.pending && <PendingBadge reason={entry.pending} />}
      {group === "current" && entry.overlimitId && (
        <Link
          href={`/overlimit/${entry.overlimitId}`}
          className="ml-1.5 inline-flex items-center rounded border border-sky-400/40 px-1 py-px text-[11px] leading-4 text-sky-200/90 transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
        >
          超限同效
        </Link>
      )}
    </div>
  );
}

function PermissionCell({ entry }: { entry: TriggerDamageEntry }) {
  const critical = formatPermission(entry.critical, "可暴击", "不可暴击");
  const weakpoint = formatPermission(entry.weakpoint, "可弱点", "不可弱点");
  const tone = (value: string, enabled: string) =>
    value === enabled ? "text-zinc-100" : "text-zinc-500";
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      <span className={tone(critical, "可暴击")}>{critical === "可暴击" ? "暴击" : critical === "不可暴击" ? "无暴击" : critical}</span>
      <span className={tone(weakpoint, "可弱点")}>{weakpoint === "可弱点" ? "弱点" : weakpoint === "不可弱点" ? "无弱点" : weakpoint}</span>
    </span>
  );
}

function MobileMeta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex gap-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{children}</span>
    </span>
  );
}

function TriggerDamageRow({ entry, group }: { entry: TriggerDamageEntry; group: TriggerDamageGroup }) {
  return (
    <article className="border-t border-zinc-700/60 px-4 py-3 first:border-t-0 transition-colors hover:bg-zinc-800/30 md:px-5 md:py-2.5">
      <div className={ROW_GRID}>
        <div className="flex items-start justify-between gap-3 md:block">
          <EntryName entry={entry} group={group} />
          <p className="shrink-0 text-right text-sm font-semibold leading-6 text-[#e2c38b] tabular-nums md:hidden">
            {entry.damageValue}
          </p>
        </div>
        <p className="mt-0.5 text-sm leading-6 text-zinc-300 md:mt-0">{entry.trigger}</p>
        <p className="hidden text-sm leading-6 text-zinc-300 md:block">{entry.interval}</p>
        <p className="hidden text-right text-sm font-semibold leading-6 text-[#e2c38b] tabular-nums md:block">
          {entry.damageValue}
        </p>
        <p className="hidden text-sm leading-6 text-zinc-300 md:block">{entry.damageType}</p>
        <div className="hidden text-sm leading-6 text-zinc-300 md:block">
          <ElementValue element={entry.element} />
        </div>
        <div className="hidden text-xs leading-6 md:block">
          <PermissionCell entry={entry} />
        </div>
        <p className="hidden text-right text-sm leading-6 text-zinc-400 tabular-nums md:block">
          {String(entry.toughness)}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 md:hidden">
          <MobileMeta label="间隔">{entry.interval}</MobileMeta>
          <MobileMeta label="类型">{entry.damageType}</MobileMeta>
          <span className="text-zinc-300">
            <ElementValue element={entry.element} />
          </span>
          <PermissionCell entry={entry} />
          <MobileMeta label="破韧">{String(entry.toughness)}</MobileMeta>
        </div>
      </div>
      {entry.note && (
        <div className={ROW_GRID}>
          <p className="mt-1.5 text-xs leading-5 text-zinc-500 md:col-span-7 md:col-start-2 md:mt-1">
            {entry.note}
          </p>
        </div>
      )}
    </article>
  );
}

const HEADERS = ["名称", "触发条件", "冷却/间隔", "猎场伤害", "伤害类型", "元素", "暴击/弱点", "破韧"];

export function TriggerDamageCatalog({ group }: { group: TriggerDamageGroup }) {
  const entries = TRIGGER_DAMAGE_GROUPS[group];

  return (
    <div className="not-prose my-5 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/35">
      <div
        aria-hidden="true"
        className={`hidden bg-zinc-800/80 px-5 py-2 text-xs font-medium text-zinc-400 ${ROW_GRID}`}
      >
        {HEADERS.map((header, index) => (
          <span key={header} className={index === 3 || index === 7 ? "text-right" : undefined}>
            {header}
          </span>
        ))}
      </div>
      {entries.map((entry) => (
        <TriggerDamageRow key={`${entry.name}-${entry.numericalId}`} entry={entry} group={group} />
      ))}
    </div>
  );
}

export function IndependentDamagePanel({ entry }: { entry: TriggerDamageEntry }) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-4 sm:px-5">
      <TriggerDamageEntryContent entry={entry} detail />
    </section>
  );
}

export const TriggerDamagePanel = IndependentDamagePanel;

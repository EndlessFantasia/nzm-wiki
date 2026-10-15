"use client";

import Image from "next/image";
import Link from "next/link";
import { Crosshair } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { SpriteIcon } from "@/components/SpriteIcon";
import { FullscreenTalentStage } from "@/components/season-talents/FullscreenTalentStage";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { getAssetPath } from "@/lib/path";
import type { WeaponType } from "@/types";

interface SeasonTalentCard {
  id: string;
  name: string;
  subtitle: string;
  background: string;
  icon: string;
  href: string;
  applicableWeapons: readonly string[];
  description: ReactNode;
}

const TALENTS: readonly SeasonTalentCard[] = [
  {
    id: "iron-fist",
    name: "铁拳狂徒",
    subtitle: "自动作战",
    background:
      "/webp/images/season-talents/T_TalentS3_BtnBG_01_1.webp",
    icon: "/webp/images/season-talents/iron-fist-card.webp",
    href: "/guides/season-talents/s3/iron-fist",
    applicableWeapons: ["全部武器类型"],
    description: (
      <>
        点击技能召唤<strong>铁拳狂徒</strong>协助战斗。仆从存在期间，长按技能可为
        <strong>铁拳狂徒</strong>指定目标；仆从存在期间，召唤物伤害增加
        <strong>30%</strong>。
      </>
    ),
  },
  {
    id: "zero",
    name: "零点",
    subtitle: "强化单体控制能力",
    background:
      "/webp/images/season-talents/T_TalentS3_BtnBG_01_2.webp",
    icon: "/webp/images/season-talents/zero-card.webp",
    href: "/guides/season-talents/s3/zero",
    applicableWeapons: ["射手步枪", "狙击步枪", "手枪"],
    description: (
      <>
        点击技能释放泡泡，控制一名敌人，持续<strong>10 秒</strong>
        。再次释放技能使其砸地进行一次爆炸，半径<strong>5 米</strong>，造成
        <strong>237%</strong>攻击力伤害。控制效果对 Boss 无法生效。
      </>
    ),
  },
  {
    id: "grappling-hook",
    name: "劫掠钩锁",
    subtitle: "强化单体爆发能力",
    background:
      "/webp/images/season-talents/T_TalentS3_BtnBG_01_3.webp",
    icon: "/webp/images/season-talents/grappling-hook-card.webp",
    href: "/guides/season-talents/s3/grappling-hook",
    applicableWeapons: ["高射速武器", "高爆发武器"],
    description: (
      <>
        点击技能释放<strong>钩锁</strong>，最远<strong>150 米</strong>
        。钩中普通怪物时，怪物进入<strong>10 秒</strong>眩晕及
        <strong>150%</strong>易伤效果，并被拉到身前。钩中非 Boss
        目标或场景物品时返还<strong>30 秒</strong>冷却时间。
      </>
    ),
  },
];

function isWeaponType(value: string): value is WeaponType {
  return Object.hasOwn(WEAPON_TYPE_SPRITES, value);
}

function TalentInfo({ talent }: { talent: SeasonTalentCard }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const showPreview = () => setIsOpen(true);

  const supportsHover = () =>
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`预览${talent.name}详细信息`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onMouseEnter={() => {
          if (supportsHover()) showPreview();
        }}
        onMouseLeave={hidePreview}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!supportsHover()) {
            setIsOpen((current) => !current);
          }
        }}
        onFocus={(event) => {
          if (supportsHover() || event.currentTarget.matches(":focus-visible")) {
            showPreview();
          }
        }}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
        className="group/info relative flex h-11 w-11 shrink-0 touch-manipulation cursor-pointer items-center justify-center text-[#9aa4ab] transition-colors duration-200 hover:text-[#e2c38b] focus-visible:text-[#e2c38b] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 focus-visible:outline-none"
      >
        <span className="flex h-5 w-5 rotate-45 items-center justify-center border border-current bg-[#101419]/80 transition-colors duration-200 group-hover/info:bg-[#d1ac69]/10">
          <span
            aria-hidden="true"
            className="flex h-3.5 w-2 -rotate-45 flex-col items-center justify-center gap-[2px]"
          >
            <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-current" />
            <span className="h-[7px] w-0.5 shrink-0 rounded-full bg-current" />
          </span>
        </span>
      </button>

      <HoverPreviewPanel open={isOpen} anchorRef={anchorRef} id={tooltipId}>
            <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-[#d1ac69]/30 bg-black/30">
                <Image
                  src={getAssetPath(talent.icon)}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {talent.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {talent.subtitle}
                </p>
              </div>
            </div>

            <div className="px-4 py-3.5">
              <div className="mb-2 text-xs font-medium text-zinc-400">
                天赋效果
              </div>
              <p className="text-sm leading-6 text-zinc-200 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
                {talent.description}
              </p>
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              <div className="mb-2.5 text-xs font-medium text-zinc-400">
                适用武器
              </div>
              <div className="flex flex-wrap gap-1.5">
                {talent.applicableWeapons.map((weapon) =>
                  isWeaponType(weapon) ? (
                    <span
                      key={weapon}
                      className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200"
                    >
                      <SpriteIcon
                        sprite={WEAPON_TYPE_SPRITES[weapon]}
                        size={28}
                        className="shrink-0"
                      />
                      {weapon}
                    </span>
                  ) : (
                    <span
                      key={weapon}
                      className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 px-2.5 py-1.5 text-xs font-medium text-[#e2c38b]"
                    >
                      <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                      {weapon}
                    </span>
                  ),
                )}
              </div>
            </div>
      </HoverPreviewPanel>
    </>
  );
}

function TalentCard({ talent }: { talent: SeasonTalentCard }) {
  return (
    <article className="group relative aspect-[3/4] min-w-0 select-none">
      <Image
        src={getAssetPath(talent.background)}
        alt=""
        fill
        sizes="(min-width: 1280px) 23rem, (min-width: 1024px) 31vw, 19rem"
        className="pointer-events-none object-fill transition-[filter] duration-200 group-hover:brightness-110 motion-reduce:transition-none"
      />
      <Image
        src={getAssetPath(talent.icon)}
        alt=""
        width={400}
        height={400}
        className="pointer-events-none absolute left-1/2 top-[18%] w-[62%] -translate-x-1/2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)] transition-[filter] duration-200 group-hover:brightness-110 motion-reduce:transition-none"
      />
      <Link
        href={talent.href}
        aria-label={`查看${talent.name}赛季天赋详情`}
        className="absolute inset-[5%] z-10 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:[&_span]:underline focus-visible:[&_span]:decoration-2 focus-visible:[&_span]:underline-offset-4"
      >
        <span className="sr-only">查看天赋树</span>
      </Link>
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[17%] z-20 text-center">
        <div className="relative mx-auto flex h-11 w-fit items-center justify-center">
          <h2 className="whitespace-nowrap text-[1.55rem] font-bold leading-none text-[#bda66f] [font-family:'Microsoft_YaHei_UI','Microsoft_YaHei',Arial,sans-serif] lg:text-[clamp(0.6rem,1.6vw,1.55rem)]">
            {talent.name}
          </h2>
          <div className="pointer-events-auto absolute left-full top-0 -ml-1">
            <TalentInfo talent={talent} />
          </div>
        </div>
        <p className="mt-1 whitespace-nowrap text-[0.95rem] font-semibold leading-tight text-[#8f8d92] [font-family:'Microsoft_YaHei_UI','Microsoft_YaHei',Arial,sans-serif] lg:mt-[clamp(0.125rem,0.4vw,0.25rem)] lg:text-[clamp(0.45rem,0.95vw,0.95rem)]">
          {talent.subtitle}
        </p>
      </div>
    </article>
  );
}

export function SeasonTalentCatalog() {
  return (
    <div className="lg:h-full">
      <section
        aria-labelledby="s3-season-talents-mobile-heading"
        className="min-h-[calc(100dvh-12.5rem)] bg-[#080b0d] px-4 pb-8 sm:px-6 lg:hidden"
      >
        <h2 id="s3-season-talents-mobile-heading" className="sr-only">
          S3 赛季天赋
        </h2>
        <div className="flex min-h-32 items-center justify-center pb-2">
          <Image
            src={getAssetPath("/webp/images/season-talents/s3/logo.webp")}
            alt="S3 荒乙兆"
            width={620}
            height={290}
            priority
            sizes="(min-width: 640px) 18rem, 72vw"
            className="h-auto w-[min(72vw,18rem)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
          />
        </div>
        <div className="mx-auto grid w-full grid-cols-1 justify-items-center gap-6">
          {TALENTS.map((talent) => (
            <div key={talent.id} className="w-full max-w-[19rem]">
              <TalentCard talent={talent} />
            </div>
          ))}
        </div>
      </section>

      <div className="hidden h-full lg:block">
        <FullscreenTalentStage
          background="/webp/images/season-talents/s3/background.webp"
          backgroundAlt="金币与赌桌组成的 S3 赛季天赋场景"
          imageClassName="object-cover object-center"
          contentClassName="flex items-end justify-center px-[3vw] pb-[7%] pt-24"
        >
          <Image
            src={getAssetPath("/webp/images/season-talents/s3/logo.webp")}
            alt="S3 荒乙兆"
            width={620}
            height={290}
            priority
            sizes="22rem"
            className="pointer-events-none absolute left-[5%] top-[20%] h-auto w-[clamp(15rem,18vw,22rem)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
          />
          <div className="grid w-full max-w-[78rem] grid-cols-[repeat(3,minmax(0,clamp(14rem,18vw,19rem)))] items-end justify-between gap-[clamp(0.5rem,2vw,2rem)]">
            {TALENTS.map((talent) => (
              <TalentCard key={talent.id} talent={talent} />
            ))}
          </div>
        </FullscreenTalentStage>
      </div>
    </div>
  );
}

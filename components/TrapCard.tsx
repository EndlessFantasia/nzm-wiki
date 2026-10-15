"use client";

import { useState } from "react";
import { CatalogLink } from "@/components/CatalogLink";
import { FadeInImage } from "@/components/FadeInImage";
import type { Trap } from "@/types";
import { getAssetPath } from "@/lib/path";

function TrapImage({ name, size = 128, className }: { name: string; size?: number; className?: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-zinc-500 ${className ?? ""}`}
        style={className ? undefined : { width: size, height: size }}
      >
        No Image
      </div>
    );
  }

  return (
    <FadeInImage
      src={getAssetPath(`/icons/traps/${name}.png`)}
      alt={name}
      width={192}
      height={192}
      className={`object-contain ${className ?? ""}`}
      style={className ? undefined : { width: size, height: size }}
      onError={() => setHasError(true)}
    />
  );
}

export function TrapCard({ trap }: { trap: Trap }) {
  return (
    <CatalogLink href={`/traps/${encodeURIComponent(trap.slug)}`} className="catalog-card block">
      <div className="catalog-card-frame rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-4 hover:border-zinc-600">
        <div className="flex justify-center mb-3">
          <TrapImage name={trap.title} />
        </div>
        <h3 className="text-center text-lg font-semibold text-white">{trap.title}</h3>
      </div>
    </CatalogLink>
  );
}

/**
 * 详情页陷阱卡片
 */
export function TrapDetailCard({ trap }: { trap: Trap }) {
  const isEmpty = (val: number | string | null | undefined) => {
    return val === null || val === undefined || val === "" || val === "-";
  };

  const formatValue = (val: number | string) => {
    if (typeof val === "string") {
      return val.replace(/(\d+)\s*[xX]\s*(\d+)/g, "$1×$2");
    }
    return val;
  };

  const stats: { label: string; value: number | string | undefined }[] = [
    { label: "攻击", value: trap.attack },
    { label: "射程", value: trap.range },
    { label: "血量", value: trap.hp },
    { label: "价格", value: trap.price },
    { label: "面积", value: trap.area },
  ];

  const visibleStats = stats.filter((s) => !isEmpty(s.value));

  return (
    <div className="rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-6">
      {/* 头部：左侧信息 + 右侧图片 */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
        {/* 左侧信息 */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{trap.title}</h1>
          {trap.position && (
            <p className="mt-1 text-sm text-zinc-400">{trap.position}</p>
          )}

          {/* 描述 */}
          {trap.description && (
            <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
              {trap.description}
            </p>
          )}

          {/* 属性 */}
          {visibleStats.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-400">陷阱属性</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {visibleStats.map((stat) => (
                  <div key={stat.label} className="flex justify-between">
                    <span className="text-zinc-500">{stat.label}</span>
                    <span className="text-white">{formatValue(stat.value!)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧图片 */}
        <div className="flex-shrink-0 self-center sm:self-start">
          <TrapImage name={trap.title} className="w-32 h-32 sm:w-48 sm:h-48" />
        </div>
      </div>
    </div>
  );
}

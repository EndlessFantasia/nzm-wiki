"use client";

import { usePathname } from "next/navigation";

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSeasonTalentDetail = pathname.startsWith("/guides/season-talents/");
  const isFullSeasonTalentDetail = isSeasonTalentDetail;
  const isSeasonTalentsLanding = pathname === "/season-talents";
  const isBuildsLanding = pathname === "/builds";
  const isGuidesLanding =
    pathname === "/guides" ||
    pathname === "/multiplier" ||
    pathname === "/season-talents" ||
    pathname === "/builds" ||
    pathname === "/posts";

  return (
    <div
      className={`relative min-h-[calc(100dvh-var(--site-header-height))] bg-background ${
        isFullSeasonTalentDetail
          ? "overflow-x-clip lg:h-[calc(100dvh-var(--site-header-height))] lg:overflow-hidden"
          : ""
      }`}
    >
      <main
        className={`relative z-10 mx-auto w-full ${
          isSeasonTalentsLanding ? "" : "xl:-left-8 2xl:-left-14"
        } ${
          isFullSeasonTalentDetail
            ? "max-w-[1600px] px-4 py-3 sm:px-6 lg:h-[calc(100dvh-var(--site-header-height))] xl:w-[calc(100%-4rem)] xl:px-12"
            : isSeasonTalentsLanding
              ? "max-w-none p-0 lg:h-[calc(100dvh-var(--site-header-height))]"
            : isSeasonTalentDetail
            ? "max-w-[1600px] px-4 py-4 sm:px-6 xl:w-[calc(100%-4rem)] xl:px-12"
            : isBuildsLanding
              ? "max-w-[1800px] px-4 py-6 sm:px-6 sm:py-7 xl:w-[calc(100%-4rem)] xl:px-12 xl:py-3"
            : isGuidesLanding
              ? "max-w-[1440px] px-4 py-6 sm:px-6 sm:py-7 xl:w-[calc(100%-4rem)] xl:py-3"
              : "max-w-7xl px-4 py-8 xl:w-[calc(100%-4rem)]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

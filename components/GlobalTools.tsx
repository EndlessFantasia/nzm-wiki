"use client";

import { usePathname } from "next/navigation";
import { Calculator } from "./Calculator";
import { CommandPalette, useCommands } from "./CommandPalette";
import { SearchPalette } from "./SearchPalette";
import { openCalculator } from "@/lib/calculator-bridge";
import { DESKTOP_CALCULATOR_PATH } from "@/lib/desktop";

export function GlobalTools() {
  const pathname = usePathname();
  const commands = useCommands({
    onOpenCalculator: openCalculator,
  });

  // 桌面端独立计算器窗口只显示计算器本身
  if (pathname === DESKTOP_CALCULATOR_PATH) return null;

  return (
    <>
      <Calculator />
      <CommandPalette commands={commands} />
      <SearchPalette />
    </>
  );
}

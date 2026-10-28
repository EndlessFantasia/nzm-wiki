"use client";

import { useEffect } from "react";
import { CalculatorPanel } from "@/components/Calculator";
import {
  CALCULATOR_CHANNEL,
  importToCalculator,
  type CalculatorImport,
} from "@/lib/calculator-bridge";
import { desktopWindow } from "@/lib/desktop";

// 桌面端独立计算器窗口（壳加载 /desktop/calculator）；关闭只隐藏窗口，状态保留
export default function DesktopCalculator() {
  useEffect(() => {
    const channel = new BroadcastChannel(CALCULATOR_CHANNEL);
    channel.onmessage = (event: MessageEvent<CalculatorImport>) => importToCalculator(event.data);

    // 重新呼出窗口时回到第一个输入框
    const handleFocus = () => {
      if (document.activeElement === document.body) {
        document.querySelector<HTMLInputElement>("input[data-value]")?.focus();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      channel.close();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-900">
      <CalculatorPanel active onClose={() => void desktopWindow()?.close()} />
    </div>
  );
}

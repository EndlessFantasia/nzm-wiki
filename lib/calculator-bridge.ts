import { useSyncExternalStore } from "react";

// 页面与浮动计算器之间的联动：共享打开状态，并通过窗口事件打开计算器、导入伤害来源
export const CALCULATOR_IMPORT_EVENT = "nzm-wiki:calculator-import";
export const CALCULATOR_OPEN_EVENT = "nzm-wiki:calculator-open";
// 桌面端主窗口把导入转发给独立计算器窗口
export const CALCULATOR_CHANNEL = "nzm-wiki:calculator";

export interface CalculatorImport {
  source: string;
  baseDamage: number;
  pellets?: number;
  weaknessMultiplier?: number;
  enableWeakness: boolean;
  enableCritical: boolean;
}

let calculatorOpen = false;
const listeners = new Set<() => void>();

export function setCalculatorOpen(open: boolean): void {
  if (calculatorOpen === open) return;
  calculatorOpen = open;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCalculatorOpen(): boolean {
  return useSyncExternalStore(subscribe, () => calculatorOpen, () => false);
}

export function openCalculator(): void {
  window.dispatchEvent(new Event(CALCULATOR_OPEN_EVENT));
}

export function importToCalculator(payload: CalculatorImport): void {
  window.dispatchEvent(new CustomEvent<CalculatorImport>(CALCULATOR_IMPORT_EVENT, { detail: payload }));
}

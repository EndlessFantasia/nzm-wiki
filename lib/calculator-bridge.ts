import { useSyncExternalStore } from "react";

// 页面与浮动计算器之间的联动：共享打开状态，并通过窗口事件导入伤害来源
export const CALCULATOR_IMPORT_EVENT = "nzm-wiki:calculator-import";

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

export function importToCalculator(payload: CalculatorImport): void {
  window.dispatchEvent(new CustomEvent<CalculatorImport>(CALCULATOR_IMPORT_EVENT, { detail: payload }));
}

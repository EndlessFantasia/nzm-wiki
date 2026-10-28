"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { Calculator as CalculatorIcon, ChevronDown, Eraser, Plus, X } from "lucide-react";
import { HUNTING_GROWTH } from "@/lib/hunting-growth";
import {
  CALCULATOR_IMPORT_EVENT,
  setCalculatorOpen,
  type CalculatorImport,
} from "@/lib/calculator-bridge";

const STORAGE_KEY = "nzm-multiplier-calculator";

type CalculatorMode = "multiplier" | "general";
type RowsKey = "extras" | "lines";
type ZoneCondition = "pellets" | "weak" | "crit" | "superCrit";

interface CalculatorRow {
  id: number;
  label: string;
  expr: string;
  placeholder?: string;
}

// bonus：同乘区加算后 1 + Σ；direct：直接作为倍率
interface ZoneDefinition {
  id: string;
  label: string;
  kind: "bonus" | "direct";
  placeholder: string;
  defaultExpr?: string;
  condition?: ZoneCondition;
  note: string;
}

// 顺序与「游戏乘区」页的伤害公式一致
const ZONES: ZoneDefinition[] = [
  { id: "pellets", label: "弹丸", kind: "direct", placeholder: "8", condition: "pellets", note: "多弹丸武器每次射击的弹丸数，全部命中时启用" },
  { id: "weakpoint", label: "弱点倍率", kind: "direct", placeholder: "1.8", condition: "weak", note: "武器类型自带：狙 1.8，射手/激光/弓 1.5，步冲机手 1.3，霰弹/近战 1.2，榴弹/喷射 1.1" },
  { id: "game-mode", label: "游戏模式", kind: "bonus", placeholder: "30%", note: "右侧选猎场商店攻击力等级；输入框填超限羁绊等其他加成，两者相加" },
  { id: "attack", label: "攻击力", kind: "bonus", placeholder: "10%", note: "攻击力增幅，通过攻击属性倍率独立参与伤害结算" },
  { id: "dilution", label: "大稀释", kind: "bonus", placeholder: "40% 25%", note: "全伤害、武器伤害、射击/爆炸/技能伤害等，同类加算" },
  { id: "element", label: "元素", kind: "bonus", placeholder: "5%", note: "本次伤害对应元素的增伤" },
  { id: "weakness", label: "弱点增伤", kind: "bonus", placeholder: "50%", condition: "weak", note: "与弱点倍率独立互乘" },
  { id: "critical", label: "暴伤", kind: "bonus", placeholder: "50%", defaultExpr: "50%", condition: "crit", note: "角色基础暴伤 50%，其余暴伤加成写在后面" },
  { id: "super-critical", label: "会心", kind: "bonus", placeholder: "200%", defaultExpr: "200%", condition: "superCrit", note: "暴击后触发会心，会心加成 +200%，即 ×3" },
  { id: "correction", label: "特殊修正", kind: "bonus", placeholder: "0%", note: "作用于具体伤害事件，可增可减" },
  { id: "vulnerability", label: "易伤", kind: "bonus", placeholder: "5%", note: "目标承受伤害增加" },
  { id: "element-vulnerability", label: "元素易伤", kind: "bonus", placeholder: "5%", note: "目标对应元素承伤增加" },
];

const CONDITION_OPTIONS: { value: ZoneCondition; label: string }[] = [
  { value: "pellets", label: "弹丸" },
  { value: "weak", label: "弱点" },
  { value: "crit", label: "暴击" },
  { value: "superCrit", label: "会心" },
];

interface CalculatorState {
  mode: CalculatorMode;
  base: string;
  source: string;
  zones: Record<string, string>;
  conditions: Record<ZoneCondition, boolean>;
  shopAttackLevel: number;
  extras: CalculatorRow[];
  lines: CalculatorRow[];
}

const DEFAULT_ZONES: Record<string, string> = Object.fromEntries(
  ZONES.map((zone) => [zone.id, zone.defaultExpr ?? ""]),
);

const DEFAULT_CONDITIONS: Record<ZoneCondition, boolean> = {
  pellets: false,
  weak: true,
  crit: true,
  superCrit: false,
};

const DEFAULT_LINES: CalculatorRow[] = [
  { id: 1, label: "", expr: "", placeholder: "12*(1-30%)" },
];

// 猎场商店攻击力（ModifierID 190100006），计入游戏模式乘区
const SHOP_ATTACK = HUNTING_GROWTH.attack;

function formatShopAttack(bonus: number): string {
  return bonus > 0 ? `+${Math.round(bonus * 100)}%` : "0%";
}

// 弹丸乘区只在导入多弹丸来源或已有内容时显示
function isZoneVisible(zoneId: string, zones: Record<string, string>): boolean {
  return zoneId !== "pellets" || Boolean(zones.pellets?.trim());
}

function formatImportNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

const DEFAULT_STATE: CalculatorState = {
  mode: "general",
  base: "",
  source: "",
  zones: DEFAULT_ZONES,
  conditions: DEFAULT_CONDITIONS,
  shopAttackLevel: 0,
  extras: [],
  lines: DEFAULT_LINES,
};

const MODE_OPTIONS: { value: CalculatorMode; label: string }[] = [
  { value: "general", label: "通用" },
  { value: "multiplier", label: "乘区" },
];

// 全角字符、× ÷、千分位和省略乘号统一成可计算的表达式
function normalize(expr: string): string {
  return expr
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
    .replace(/\^/g, "**")
    .replace(/\)\(/g, ")*(")
    .replace(/(\d)\(/g, "$1*(")
    .replace(/\)(\d)/g, ")*$1")
    .replace(/^\*/, "");
}

function evaluate(expr: string): number | null {
  if (!/^[\d+\-*/().]+$/.test(expr)) return null;
  try {
    const result = new Function(`return (${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// bonus 乘区：30% 20% → ×1.5（空格分隔视为相加），没写 % 时整体按百分数（30 20 → ×1.5），× 开头时直接作为倍率
function parseZone(input: string, kind: ZoneDefinition["kind"]): number | null | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (kind === "direct" || /^[×xX*＊]/.test(trimmed)) return parseExpression(trimmed);
  const value = parseExpression(trimmed.replace(/([\d%％)）])\s+(?=[\d.(（])/g, "$1+"));
  if (typeof value !== "number") return value;
  return 1 + (/[%％]/.test(trimmed) ? value : value / 100);
}

function parseExpression(input: string): number | null | undefined {
  const s = normalize(input);
  if (!s) return undefined;
  return evaluate(s);
}

function formatNumber(value: number, maxFractionDigits: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: maxFractionDigits });
}

function loadState(): CalculatorState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalculatorState>;
    const zones = { ...DEFAULT_ZONES, ...parsed.zones };
    // 旧版会心按倍率保存为 "2"，现在按加成计算
    if (zones["super-critical"] === "2") zones["super-critical"] = DEFAULT_ZONES["super-critical"];
    return {
      mode: parsed.mode === "multiplier" ? "multiplier" : "general",
      base: typeof parsed.base === "string" ? parsed.base : "",
      source: typeof parsed.source === "string" ? parsed.source : "",
      zones,
      conditions: { ...DEFAULT_CONDITIONS, ...parsed.conditions },
      shopAttackLevel: SHOP_ATTACK.rows.some((row) => row.level === parsed.shopAttackLevel)
        ? (parsed.shopAttackLevel as number)
        : 0,
      extras: Array.isArray(parsed.extras) ? parsed.extras : [],
      lines: Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed.lines : DEFAULT_LINES,
    };
  } catch {
    return null;
  }
}

interface CalculatorProps {
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Calculator({
  externalOpen,
  onOpenChange,
}: CalculatorProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [state, setState] = useState<CalculatorState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [iconPosition, setIconPosition] = useState({ right: 16, bottom: 16 });
  const [windowPosition, setWindowPosition] = useState({ right: 16, bottom: 16 });
  const [size, setSize] = useState({ width: 380, height: 480 });
  const [isDragging, setIsDragging] = useState<false | "icon" | "window">(false);
  const [isResizing, setIsResizing] = useState<false | "nw" | "se">(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, right: 0, bottom: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, width: 0, height: 0, right: 0, bottom: 0 });
  const hasDraggedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const shopMenuRef = useRef<HTMLDivElement>(null);

  // 支持外部控制和内部控制
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open);
      }
      setInternalOpen(open);
    },
    [onOpenChange],
  );

  useEffect(() => {
    const restoreSavedState = () => {
      const saved = loadState();
      if (saved) setState(saved);
      setLoaded(true);
    };
    restoreSavedState();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储不可用时只保留当前会话
    }
  }, [state, loaded]);

  useEffect(() => {
    setCalculatorOpen(isOpen);
  }, [isOpen]);

  // 页面导入伤害来源：替换武器相关字段，保留其他乘区
  useEffect(() => {
    const handleImport = (event: Event) => {
      const data = (event as CustomEvent<CalculatorImport>).detail;
      setState((prev) => ({
        ...prev,
        mode: "multiplier",
        base: formatImportNumber(data.baseDamage),
        source: data.source,
        zones: {
          ...prev.zones,
          pellets: data.pellets && data.pellets > 1 ? String(data.pellets) : "",
          weakpoint:
            data.enableWeakness && data.weaknessMultiplier !== undefined
              ? formatImportNumber(data.weaknessMultiplier)
              : "",
        },
        conditions: {
          ...prev.conditions,
          pellets: false,
          weak: data.enableWeakness,
          crit: data.enableCritical,
          superCrit: data.enableCritical && prev.conditions.superCrit,
        },
      }));
      setIsOpen(true);
    };
    window.addEventListener(CALCULATOR_IMPORT_EVENT, handleImport);
    return () => window.removeEventListener(CALCULATOR_IMPORT_EVENT, handleImport);
  }, [setIsOpen]);

  const focusFirstValueInput = useCallback(() => {
    setTimeout(() => {
      bodyRef.current?.querySelector<HTMLInputElement>("input[data-value]")?.focus();
    }, 0);
  }, []);

  // 打开时聚焦第一个输入框
  useEffect(() => {
    if (isOpen) {
      // 延迟聚焦，等待动画完成
      const timer = setTimeout(() => {
        bodyRef.current?.querySelector<HTMLInputElement>("input[data-value]")?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Icon 拖拽开始
  const handleIconMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      hasDraggedRef.current = false;
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        right: iconPosition.right,
        bottom: iconPosition.bottom,
      };
      setIsDragging("icon");
    },
    [iconPosition],
  );

  // 窗口拖拽开始
  const handleWindowMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        right: windowPosition.right,
        bottom: windowPosition.bottom,
      };
      setIsDragging("window");
    },
    [windowPosition],
  );

  // 拖拽移动和结束
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartRef.current.mouseX - e.clientX;
      const deltaY = dragStartRef.current.mouseY - e.clientY;

      // 如果移动超过 5px，标记为拖拽（仅对 icon 有意义）
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newRight = Math.max(
        0,
        Math.min(window.innerWidth - 60, dragStartRef.current.right + deltaX),
      );
      const newBottom = Math.max(
        0,
        Math.min(window.innerHeight - 60, dragStartRef.current.bottom + deltaY),
      );

      if (isDragging === "icon") {
        setIconPosition({ right: newRight, bottom: newBottom });
      } else {
        setWindowPosition({ right: newRight, bottom: newBottom });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 处理点击打开（区分拖拽和点击）
  const handleButtonClick = useCallback(() => {
    if (!hasDraggedRef.current) {
      setIsOpen(true);
    }
  }, [setIsOpen]);

  // 调整大小开始（左上角）
  const handleResizeNWMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: size.width,
        height: size.height,
        right: windowPosition.right,
        bottom: windowPosition.bottom,
      };
      setIsResizing("nw");
    },
    [size, windowPosition],
  );

  // 调整大小开始（右下角）
  const handleResizeSEMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: size.width,
        height: size.height,
        right: windowPosition.right,
        bottom: windowPosition.bottom,
      };
      setIsResizing("se");
    },
    [size, windowPosition],
  );

  // 调整大小移动和结束
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartRef.current.mouseX - e.clientX;
      const deltaY = resizeStartRef.current.mouseY - e.clientY;

      let newWidth: number;
      let newHeight: number;

      if (isResizing === "nw") {
        // 左上角：鼠标向左/上移动增大
        newWidth = Math.max(280, Math.min(600, resizeStartRef.current.width + deltaX));
        newHeight = Math.max(240, Math.min(600, resizeStartRef.current.height + deltaY));
        setSize({ width: newWidth, height: newHeight });
      } else {
        // 右下角：鼠标向右/下移动增大
        newWidth = Math.max(280, Math.min(600, resizeStartRef.current.width - deltaX));
        newHeight = Math.max(240, Math.min(600, resizeStartRef.current.height - deltaY));

        // 基于初始位置计算新位置，保持右下角固定
        const widthDelta = newWidth - resizeStartRef.current.width;
        const heightDelta = newHeight - resizeStartRef.current.height;

        setSize({ width: newWidth, height: newHeight });
        setWindowPosition({
          right: Math.max(16, resizeStartRef.current.right - widthDelta),
          bottom: Math.max(16, resizeStartRef.current.bottom - heightDelta),
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const isGeneral = state.mode === "general";
  const rowsKey: RowsKey = isGeneral ? "lines" : "extras";

  const setMode = (mode: CalculatorMode) => {
    setState((prev) => ({ ...prev, mode }));
    focusFirstValueInput();
  };

  const resetCurrent = () => {
    setState((prev) =>
      prev.mode === "general"
        ? { ...prev, lines: DEFAULT_LINES }
        : {
            ...prev,
            base: "",
            source: "",
            zones: DEFAULT_ZONES,
            conditions: DEFAULT_CONDITIONS,
            shopAttackLevel: 0,
            extras: [],
          },
    );
    focusFirstValueInput();
  };

  const setBase = (base: string) => setState((prev) => ({ ...prev, base, source: "" }));

  const setZone = (id: string, expr: string) =>
    setState((prev) => ({ ...prev, zones: { ...prev.zones, [id]: expr } }));

  const setShopAttackLevel = (shopAttackLevel: number) => {
    setState((prev) => ({ ...prev, shopAttackLevel }));
    setShopMenuOpen(false);
  };

  // 商店攻击力菜单：点外部或 Esc 关闭，打开时滚动到当前选项
  useEffect(() => {
    if (!shopMenuOpen) return;
    shopMenuRef.current
      ?.querySelector<HTMLElement>("[aria-selected='true']")
      ?.scrollIntoView({ block: "nearest" });
    const handleMouseDown = (e: MouseEvent) => {
      if (!shopMenuRef.current?.contains(e.target as Node)) setShopMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShopMenuOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shopMenuOpen]);

  const toggleCondition = (condition: ZoneCondition) =>
    setState((prev) => ({
      ...prev,
      conditions: { ...prev.conditions, [condition]: !prev.conditions[condition] },
    }));

  const updateRow = (id: number, field: "label" | "expr", value: string) => {
    setState((prev) => ({
      ...prev,
      [rowsKey]: prev[rowsKey].map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));
  };

  const removeRow = (id: number) => {
    setState((prev) => {
      const next = prev[rowsKey].filter((row) => row.id !== id);
      return { ...prev, [rowsKey]: rowsKey === "lines" && next.length === 0 ? DEFAULT_LINES : next };
    });
  };

  const addRow = () => {
    const id = Math.max(0, ...state[rowsKey].map((row) => row.id)) + 1;
    const row = { id, label: isGeneral ? "" : "乘区", expr: "" };
    // 同步提交后立即聚焦，避免连续输入落到上一行
    flushSync(() => {
      setState((prev) => ({ ...prev, [rowsKey]: [...prev[rowsKey], row] }));
    });
    const inputs = bodyRef.current?.querySelectorAll<HTMLInputElement>("input[data-value]");
    inputs?.[inputs.length - 1]?.focus();
  };

  // Enter 跳到下一个数值框，最后一行回车新增一行
  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>("input[data-value]") ?? [],
    );
    const next = inputs[inputs.indexOf(e.currentTarget) + 1];
    if (next) next.focus();
    else if (isGeneral) addRow();
  };

  // 乘区模式：未触发条件的乘区按 ×1 处理
  const baseValue = parseExpression(state.base);
  const shopAttackBonus =
    SHOP_ATTACK.rows.find((row) => row.level === state.shopAttackLevel)?.bonus ?? 0;
  const zoneValues = ZONES.map((zone) => {
    const value = parseZone(state.zones[zone.id] ?? "", zone.kind);
    return {
      ...zone,
      active: !zone.condition || state.conditions[zone.condition],
      value:
        zone.id === "game-mode" && shopAttackBonus > 0 && value !== null
          ? (value ?? 1) + shopAttackBonus
          : value,
    };
  });
  const extraValues = state.extras.map((row) => ({ ...row, value: parseZone(row.expr, "bonus") }));
  const validFactors = [
    ...zoneValues.filter((zone) => zone.active),
    ...extraValues,
  ].filter((row): row is typeof row & { value: number } => typeof row.value === "number" && row.value !== 1);
  const totalMultiplier = validFactors.reduce((acc, row) => acc * row.value, 1);
  const multiplierResult = typeof baseValue === "number" ? baseValue * totalMultiplier : null;
  const multiplierFormula = [
    ...(typeof baseValue === "number" ? [formatNumber(baseValue, 4)] : []),
    ...validFactors.map((row) => formatNumber(row.value, 4)),
  ].join(" × ");
  const activeConditionLabel = CONDITION_OPTIONS.filter((option) => state.conditions[option.value])
    .map((option) => option.label)
    .join(" · ");

  // 通用模式：_ 引用上一条有内容的结果，底部合计所有行
  const lineValues: (CalculatorRow & { value: number | null | undefined })[] = [];
  let previousValue: number | null | undefined;
  for (const line of state.lines) {
    let value: number | null | undefined;
    if (line.expr.includes("_")) {
      value =
        typeof previousValue === "number"
          ? parseExpression(line.expr.replace(/_/g, `(${previousValue})`))
          : null;
    } else {
      value = parseExpression(line.expr);
    }
    lineValues.push({ ...line, value });
    if (value !== undefined) previousValue = value;
  }
  const validLines = lineValues.filter(
    (line): line is CalculatorRow & { value: number } => typeof line.value === "number",
  );
  const lineSum = validLines.reduce((acc, line) => acc + line.value, 0);
  const sumFormula =
    validLines.length > 1
      ? validLines
          .map((line) => (line.value < 0 ? `(${formatNumber(line.value, 4)})` : formatNumber(line.value, 4)))
          .join(" + ")
      : "";

  // 计算窗口的安全位置，确保在可视范围内
  const getWindowStyle = useCallback(() => {
    if (typeof window === "undefined") {
      return { right: windowPosition.right, bottom: windowPosition.bottom };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 计算窗口右下角的位置
    let right = windowPosition.right;
    let bottom = windowPosition.bottom;

    // 确保窗口不会超出左边界
    if (right > viewportWidth - size.width) {
      right = viewportWidth - size.width - 16;
    }

    // 确保窗口不会超出上边界
    if (bottom > viewportHeight - size.height) {
      bottom = viewportHeight - size.height - 16;
    }

    // 确保不小于 0
    right = Math.max(16, right);
    bottom = Math.max(16, bottom);

    return { right, bottom };
  }, [windowPosition, size]);

  const valueInputClass = (invalid: boolean) =>
    `w-full min-w-0 rounded-md border bg-zinc-800 py-1.5 pl-2.5 ${isGeneral ? "pr-20" : "pr-14"} text-sm tabular-nums text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-400 ${
      invalid ? "border-red-500/60" : "border-zinc-700"
    }`;

  const renderRow = (
    row: CalculatorRow & { value: number | null | undefined },
    hint: string,
    fallbackPlaceholder: string,
  ) => (
    <div key={row.id} className="group flex items-center gap-2">
      <input
        type="text"
        value={row.label}
        onChange={(e) => updateRow(row.id, "label", e.target.value)}
        className="w-16 shrink-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-zinc-400 outline-none transition-colors placeholder:text-zinc-700 hover:border-zinc-700 focus:border-zinc-500 focus:text-zinc-200"
        placeholder={isGeneral ? "备注" : undefined}
        title="点击改名"
        spellCheck={false}
      />
      <div className="relative min-w-0 flex-1">
        <input
          data-value
          type="text"
          value={row.expr}
          onChange={(e) => updateRow(row.id, "expr", e.target.value)}
          onKeyDown={handleValueKeyDown}
          className={valueInputClass(row.value === null)}
          placeholder={row.placeholder ?? fallbackPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />
        <span
          className={`pointer-events-none absolute right-2.5 top-1/2 max-w-[4.5rem] -translate-y-1/2 truncate text-xs tabular-nums ${
            row.value === null
              ? "text-red-400"
              : typeof row.value === "number"
                ? isGeneral ? "text-amber-200/80" : "text-zinc-400"
                : "text-zinc-600"
          }`}
        >
          {row.value === null ? "无法识别" : hint}
        </span>
      </div>
      <button
        type="button"
        onClick={() => removeRow(row.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 opacity-0 outline-none transition-opacity hover:bg-zinc-800 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        title="删除这一行"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <>
      {/* 折叠按钮 - 可拖拽 */}
      <div
        className={`hidden md:block fixed z-50 ${isDragging === "icon" ? "select-none" : ""}`}
        style={{ right: iconPosition.right, bottom: iconPosition.bottom }}
      >
        <div
          className={`transition-all duration-300 ease-out ${
            isOpen
              ? "pointer-events-none scale-50 opacity-0"
              : "scale-100 opacity-100"
          }`}
        >
          <div
            onMouseDown={handleIconMouseDown}
            onClick={handleButtonClick}
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg ring-1 ring-zinc-700 transition-all hover:bg-zinc-700 hover:text-white hover:scale-110 ${isDragging === "icon" ? "cursor-grabbing" : "cursor-grab"}`}
            title="计算器"
          >
            <CalculatorIcon className="h-6 w-6 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 展开的计算器 - 独立定位 */}
      <div
        className={`hidden md:flex fixed z-50 flex-col overflow-hidden rounded-lg bg-zinc-900 shadow-2xl ring-1 ring-zinc-700 ${
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-75 opacity-0"
        } ${isDragging || isResizing ? "select-none" : ""} ${!isDragging && !isResizing ? "transition-all duration-300 ease-out" : ""}`}
        style={{ width: size.width, height: size.height, ...getWindowStyle() }}
      >
        {/* 左上角调整大小手柄 - 四分之一圆弧 */}
        <div
          className="absolute left-1 top-1 w-4 h-4 cursor-nwse-resize z-10 group"
          onMouseDown={handleResizeNWMouseDown}
        >
          <div className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-zinc-600 rounded-tl-md opacity-40 group-hover:opacity-80 transition-opacity" />
        </div>

        {/* 右下角调整大小手柄 - 四分之一圆弧 */}
        <div
          className="absolute right-1 bottom-1 w-4 h-4 cursor-nwse-resize z-10 group"
          onMouseDown={handleResizeSEMouseDown}
        >
          <div className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-zinc-600 rounded-br-md opacity-40 group-hover:opacity-80 transition-opacity" />
        </div>

        {/* 标题栏 - 可拖拽 */}
        <div
          className={`flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-1.5 ${
            isDragging === "window" ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleWindowMouseDown}
        >
          <div
            className="flex rounded-md bg-zinc-900/70 p-0.5 text-xs"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`rounded px-2.5 py-1 outline-none transition-colors focus-visible:underline ${
                  state.mode === option.value
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={resetCurrent}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title="清空当前页"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title="关闭 (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 输入区 */}
        <div ref={bodyRef} className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {isGeneral ? (
            lineValues.map((line) =>
              renderRow(
                line,
                typeof line.value === "number" ? `= ${formatNumber(line.value, 4)}` : "",
                "_ 引用上一行",
              ),
            )
          ) : (
            <>
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className="mr-0.5 text-xs text-zinc-500">触发</span>
                {CONDITION_OPTIONS.filter((option) => isZoneVisible(option.value, state.zones)).map((option) => {
                  const active = state.conditions[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCondition(option.value)}
                      className={`rounded border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:underline ${
                        active
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                          : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 px-1 text-sm text-zinc-300" title="武器白值 × 模式攻击力（猎场 500，塔防 400）">
                  基础伤害
                </span>
                <div className="relative min-w-0 flex-1">
                  <input
                    data-value
                    type="text"
                    inputMode="decimal"
                    value={state.base}
                    onChange={(e) => setBase(e.target.value)}
                    onKeyDown={handleValueKeyDown}
                    className={valueInputClass(baseValue === null)}
                    placeholder="0.52×500"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {typeof baseValue === "number" && (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 max-w-[4.5rem] -translate-y-1/2 truncate text-xs tabular-nums text-zinc-400">
                      = {formatNumber(baseValue, 2)}
                    </span>
                  )}
                </div>
                <span className="w-6 shrink-0" />
              </div>
              {state.source && (
                <p className="-mt-0.5 truncate pl-18 text-xs text-zinc-500" title={state.source}>
                  来自 {state.source}
                </p>
              )}
              {zoneValues.filter((zone) => isZoneVisible(zone.id, state.zones)).map((zone) => (
                <div
                  key={zone.id}
                  className={`flex items-center gap-2 transition-opacity ${zone.active ? "" : "opacity-40"}`}
                >
                  <span className="w-16 shrink-0 cursor-help px-1 text-sm text-zinc-400" title={zone.note}>
                    {zone.label}
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <input
                      data-value
                      type="text"
                      value={state.zones[zone.id] ?? ""}
                      onChange={(e) => setZone(zone.id, e.target.value)}
                      onKeyDown={handleValueKeyDown}
                      className={valueInputClass(zone.value === null)}
                      placeholder={zone.placeholder}
                      title={zone.note}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <span
                      className={`pointer-events-none absolute right-2.5 top-1/2 max-w-[4.5rem] -translate-y-1/2 truncate text-xs tabular-nums ${
                        zone.value === null
                          ? "text-red-400"
                          : typeof zone.value === "number" && zone.active
                            ? "text-zinc-400"
                            : "text-zinc-600"
                      }`}
                    >
                      {zone.value === null
                        ? "无法识别"
                        : zone.active
                          ? `×${formatNumber(typeof zone.value === "number" ? zone.value : 1, 4)}`
                          : "未触发"}
                    </span>
                  </div>
                  {zone.id === "game-mode" ? (
                    <div ref={shopMenuRef} className="relative flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShopMenuOpen((open) => !open)}
                        aria-haspopup="listbox"
                        aria-expanded={shopMenuOpen}
                        title="猎场商店攻击力"
                        className={`h-[34px] w-20 rounded-md border bg-zinc-800 px-2 text-sm tabular-nums outline-none transition-colors hover:border-zinc-500 focus-visible:underline ${
                          shopMenuOpen ? "border-zinc-500" : "border-zinc-700"
                        } ${state.shopAttackLevel > 0 ? "font-semibold text-zinc-100" : "text-zinc-600"}`}
                      >
                        {formatShopAttack(shopAttackBonus)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShopMenuOpen((open) => !open)}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:text-zinc-200"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${shopMenuOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {shopMenuOpen && (
                        <div
                          role="listbox"
                          aria-label="猎场商店攻击力"
                          className="absolute right-8 top-full z-20 mt-1 max-h-52 w-20 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
                        >
                          {SHOP_ATTACK.rows.map((row) => {
                            const selected = row.level === state.shopAttackLevel;
                            return (
                              <button
                                key={row.level}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => setShopAttackLevel(row.level)}
                                className={`block w-full px-2 py-1 text-center text-sm tabular-nums outline-none transition-colors focus-visible:underline ${
                                  selected
                                    ? "bg-zinc-700 text-zinc-100"
                                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                                }`}
                              >
                                {formatShopAttack(row.bonus)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="w-6 shrink-0" />
                  )}
                </div>
              ))}
              {extraValues.map((row) =>
                renderRow(
                  row,
                  `×${formatNumber(typeof row.value === "number" ? row.value : 1, 4)}`,
                  "20%",
                ),
              )}
            </>
          )}

          <button
            type="button"
            onClick={addRow}
            className="ml-18 flex items-center gap-1 rounded px-1 py-1 text-xs text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {isGeneral ? "添加一行" : "自定义乘区"}
          </button>
        </div>

        {/* 结果 */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2.5">
          {isGeneral ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  {validLines.length > 1 ? `合计 · ${validLines.length} 项` : "结果"}
                </span>
                <span className="text-xl font-semibold tabular-nums text-amber-200">
                  {formatNumber(lineSum, 4)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-right text-xs tabular-nums text-zinc-600" title={sumFormula}>
                {sumFormula || "回车算下一行，所有行自动相加"}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  {multiplierResult !== null ? "结果" : "总倍率"}
                  {activeConditionLabel && ` · ${activeConditionLabel}`}
                </span>
                <span className="text-xl font-semibold tabular-nums text-amber-200">
                  {multiplierResult !== null
                    ? formatNumber(multiplierResult, 2)
                    : `×${formatNumber(totalMultiplier, 4)}`}
                </span>
              </div>
              <div className="mt-0.5 truncate text-right text-xs tabular-nums text-zinc-600" title={multiplierFormula}>
                {multiplierFormula || "同乘区加算，% 可省略：30 20 = ×1.5"}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

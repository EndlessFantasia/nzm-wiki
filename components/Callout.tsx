import { CALLOUT_BOLD_COLOR } from "@/constants/colors";

/**
 * 自动在中文和数字/英文/百分号之间添加空格
 * 如果已有空格则不重复添加
 */
function autoSpace(text: string): string {
  // 中文后接数字/英文/百分号，且中间没有空格
  let result = text.replace(
    /([\u4e00-\u9fff])([A-Za-z0-9%])/g,
    "$1 $2"
  );
  // 数字/英文/百分号后接中文，且中间没有空格
  result = result.replace(
    /([A-Za-z0-9%])([\u4e00-\u9fff])/g,
    "$1 $2"
  );
  return result;
}

type CalloutColor = "gray" | "blue" | "green" | "yellow" | "red" | "purple";

const COLOR_MAP: Record<CalloutColor, { bg: string; border: string; bar: string }> = {
  gray: {
    bg: "bg-zinc-800/30",
    border: "border-zinc-700",
    bar: "bg-zinc-500",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    bar: "bg-blue-500",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    bar: "bg-green-500",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    bar: "bg-yellow-500",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    bar: "bg-red-500",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    bar: "bg-purple-500",
  },
};

interface CalloutProps {
  children: React.ReactNode;
  color?: CalloutColor;
}

export function Callout({ children, color = "gray" }: CalloutProps) {
  const colors = COLOR_MAP[color];

  // 递归处理子元素中的文本节点
  const processChildren = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      return autoSpace(node);
    }
    return node;
  };

  return (
    <div className={`${color === "gray" ? "detail-panel " : ""}my-4 overflow-hidden rounded-xl border ${colors.border} ${colors.bg} px-4 py-3`}>
      <style>{`
        .callout strong { color: ${CALLOUT_BOLD_COLOR}; }
      `}</style>
      <div className="callout text-base text-foreground leading-relaxed [&>p]:m-0">
        {Array.isArray(children)
          ? children.map((child, i) => (
              <span key={i}>{processChildren(child)}</span>
            ))
          : processChildren(children)}
      </div>
    </div>
  );
}

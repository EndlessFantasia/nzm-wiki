"use client";

import Image from "next/image";
import { getAssetPath } from "@/lib/path";
import { CALLOUT_BOLD_COLOR } from "@/constants/colors";

type Align = "left" | "center" | "right";

type CellValue = string | number | React.ReactNode;

type RowData =
  | CellValue[]
  | { icon?: string; cells: CellValue[] };

interface DataTableProps {
  headers: string[];
  align?: Align[];
  nowrap?: number[];
  iconSize?: number;
  data: RowData[];
}

function getAlignClass(align: Align) {
  switch (align) {
    case "left":
      return "text-left";
    case "right":
      return "text-right";
    default:
      return "text-center";
  }
}

function getRow(row: RowData) {
  if (Array.isArray(row)) return { icon: undefined, cells: row };
  return row;
}

// 解析简单的 **bold** 语法
function parseMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2);
      return (
        <strong key={i} style={{ color: CALLOUT_BOLD_COLOR }}>
          {content}
        </strong>
      );
    }
    return part;
  });
}

function renderCell(cell: CellValue): React.ReactNode {
  if (typeof cell === "string") {
    return parseMarkdown(cell);
  }
  return cell;
}

export function DataTable({ headers, align, nowrap, iconSize = 24, data }: DataTableProps) {
  const nowrapSet = new Set(nowrap || []);

  return (
    <div className="detail-panel detail-table not-prose my-4 overflow-x-auto rounded-xl border border-zinc-700">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="bg-zinc-800/80">
            {headers.map((header, i) => (
              <th
                key={i}
                className={`px-4 py-3 font-medium text-foreground ${getAlignClass(align?.[i] || "center")} ${nowrapSet.has(i) ? "whitespace-nowrap" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((rowData, rowIndex) => {
            const { icon, cells } = getRow(rowData);
            return (
              <tr
                key={rowIndex}
                className="border-t border-zinc-700/50 bg-zinc-800/30 transition-colors hover:bg-zinc-700/30"
              >
                {cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-2.5 text-foreground ${getAlignClass(align?.[cellIndex] || "center")} ${nowrapSet.has(cellIndex) ? "whitespace-nowrap" : ""}`}
                  >
                    {cellIndex === 0 && icon ? (
                      <div className={`flex items-center gap-2 ${align?.[0] === "left" ? "" : "justify-center"}`}>
                        <Image
                          src={getAssetPath(icon)}
                          alt=""
                          width={iconSize}
                          height={iconSize}
                          style={{ width: iconSize, height: iconSize }}
                        />
                        <span>{renderCell(cell)}</span>
                      </div>
                    ) : (
                      renderCell(cell)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

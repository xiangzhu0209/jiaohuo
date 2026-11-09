import { Fragment } from "react";
import type { SalesPrintMark } from "@/lib/sales-types";
import { cn } from "@/lib/utils";

/** 顯示時只有原文未變更的標記才生效，避免舊位置標到新文字。 */
function emphasisParts(text: string, field: string, marks: SalesPrintMark[]) {
  const relevant = marks.filter((mark) => mark.field === field && mark.text === text);
  if (!relevant.length) return text;
  const chars = Array.from({ length: text.length }, (_, i) => ({
    red: relevant.some((m) => m.red && m.start <= i && i < m.end),
    bold: relevant.some((m) => m.bold && m.start <= i && i < m.end),
  }));
  const result = [];
  for (let i = 0; i < text.length;) {
    let end = i + 1;
    while (end < text.length && chars[end].red === chars[i].red && chars[end].bold === chars[i].bold) end++;
    result.push(
      <Fragment key={i}>
        <tspan className={cn("cursor-text select-text", chars[i].red && "text-destructive", chars[i].bold && "font-bold")} fill="currentColor">
          {text.slice(i, end)}
        </tspan>
      </Fragment>,
    );
    i = end;
  }
  return result;
}

/** HTML 與 SVG 都可選字；使用對應容器顯示相同記號。 */
export function SalesText({ text, field, marks, svg = false }: {
  text: string;
  field: string;
  marks: SalesPrintMark[];
  svg?: boolean;
}) {
  if (svg) return <tspan data-sales-field={field}>{emphasisParts(text, field, marks)}</tspan>;
  const relevant = marks.filter((mark) => mark.field === field && mark.text === text);
  const parts = [];
  for (let i = 0; i < text.length;) {
    const red = relevant.some((m) => m.red && m.start <= i && i < m.end);
    const bold = relevant.some((m) => m.bold && m.start <= i && i < m.end);
    let end = i + 1;
    while (end < text.length && relevant.some((m) => m.red && m.start <= end && end < m.end) === red &&
      relevant.some((m) => m.bold && m.start <= end && end < m.end) === bold) end++;
    parts.push(<span key={i} className={cn("cursor-text select-text", red && "text-destructive", bold && "font-bold")}>{text.slice(i, end)}</span>);
    i = end;
  }
  return <span data-sales-field={field}>{parts}</span>;
}


import type { SalesPrintMark } from "./sales-types";

export type SalesSelectionHit = { orderId: string; field: string; text: string; start: number; end: number };

export function collectSalesSelection(range: Range, root: HTMLElement): SalesSelectionHit[] {
  const hits: SalesSelectionHit[] = [];
  for (const element of root.querySelectorAll<HTMLElement | SVGElement>("[data-sales-field]")) {
    try {
      if (!range.intersectsNode(element)) continue;
    } catch {
      continue;
    }
    const field = element.getAttribute("data-sales-field");
    const orderId = element.closest("[data-sales-order]")?.getAttribute("data-sales-order");
    const text = element.textContent ?? "";
    if (!field || !orderId || !text || text === "—") continue;
    const offset = (node: Node, position: number, defaultValue: number) => {
      if (!element.contains(node)) return defaultValue;
      const part = document.createRange();
      part.selectNodeContents(element);
      part.setEnd(node, position);
      return Math.min(text.length, part.toString().length);
    };
    const start = offset(range.startContainer, range.startOffset, 0);
    const end = offset(range.endContainer, range.endOffset, text.length);
    if (end > start) hits.push({ orderId, field, text, start, end });
  }
  return hits;
}

export function updateSalesMarks(marks: SalesPrintMark[], hits: SalesSelectionHit[], action: "red" | "bold" | "clear"): SalesPrintMark[] {
  let next = [...marks];
  for (const hit of hits) {
    const overlaps = (m: SalesPrintMark) => m.field === hit.field && m.text === hit.text && m.end > hit.start && m.start < hit.end;
    if (action === "clear") {
      next = next.flatMap((mark) => {
        if (!overlaps(mark)) return [mark];
        const remaining: SalesPrintMark[] = [];
        if (mark.start < hit.start) remaining.push({ ...mark, end: hit.start });
        if (mark.end > hit.end) remaining.push({ ...mark, start: hit.end });
        return remaining;
      });
    } else {
      next.push({ field: hit.field, text: hit.text, start: hit.start, end: hit.end, [action]: true });
    }
  }
  return next;
}

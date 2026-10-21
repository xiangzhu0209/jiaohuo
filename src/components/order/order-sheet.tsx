import { Fragment, type ReactNode } from "react";
import type { EmphasisField, EmphasisMark, Order, OrderItem } from "@/lib/types";
import { fmtMoney, statusLabel, toNum } from "@/lib/order-utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * 依「強調」記號把文字切成有樣式的小片段：記號只記錄欄位與字元範圍，
 * 文字本身沒有被改動，所以對帳統計、自動帶價都不受影響。
 */
function emphasized(text: string, marks: EmphasisMark[] | undefined, key: string): ReactNode {
  if (!text || !marks || marks.length === 0) return text;
  const red: boolean[] = new Array(text.length).fill(false);
  const bold: boolean[] = new Array(text.length).fill(false);
  for (const m of marks) {
    const from = Math.max(0, Math.min(m.start, text.length));
    const to = Math.max(from, Math.min(m.end, text.length));
    for (let i = from; i < to; i++) {
      if (m.red) red[i] = true;
      if (m.bold) bold[i] = true;
    }
  }
  const parts: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    let j = i + 1;
    while (j < text.length && red[j] === red[i] && bold[j] === bold[i]) j++;
    const segment = text.slice(i, j);
    parts.push(
      red[i] || bold[i] ? (
        <span key={`${key}-${i}`} className={cn(red[i] && "text-red-600", bold[i] && "font-bold")}>
          {segment}
        </span>
      ) : (
        segment
      ),
    );
    i = j;
  }
  return parts;
}

/**
 * A single 叫貨單 sheet. When `showVendorColumn` is true all vendors' items are
 * listed together with a 廠商 column (one customer, one sheet); otherwise the
 * sheet shows a single vendor's items with the vendor name in the header.
 * Per-vendor 訂單備註 are printed next to their vendor group.
 * `paper` 選 A4 直式（預設）或 A5 橫式（較緊湊，字級仍放大以便閱讀）。
 */
export default function OrderSheet({
  order,
  items,
  issuer,
  vendorName,
  showVendorColumn,
  paper = "a4",
}: {
  order: Order;
  items: OrderItem[];
  issuer: string;
  vendorName?: string;
  showVendorColumn?: boolean;
  paper?: "a4" | "a5l";
}) {
  const compact = paper === "a5l";
  const vendorNotes = order.vendorNotes ?? {};
  const vendorNote = (vendorId: string | null | undefined) =>
    (vendorId ? vendorNotes[vendorId] : "")?.trim() || "";

  // 單獨印某一廠商時，在標頭顯示該廠商備註
  const singleNote = !showVendorColumn && items.length > 0 ? vendorNote(items[0].vendorId) : "";

  // 列印字級：A5 橫式縮一級但仍比原本大，A4 用 16px 主體
  const tableText = compact ? "text-sm" : "text-base";
  const metaText = compact ? "text-xs" : "text-sm";
  const infoText = compact ? "text-sm" : "text-base";
  const labelText = compact ? "text-xs" : "text-sm";
  const cellY = compact ? "py-1" : "py-1.5";

  return (
    <div
      className={cn(
        "paper-sheet rounded-lg border bg-card text-card-foreground shadow-elegant",
        compact ? "p-3" : "p-6",
        compact && "sheet-a5-landscape",
      )}
    >
      {/* Sheet header */}
      <div className={cn("flex items-start justify-between border-b pb-2", compact ? "mb-2" : "mb-3")}>
        <div>
          <h1 className={cn("font-bold tracking-wide", compact ? "text-lg" : "text-2xl")}>
            叫貨單
          </h1>
          {/*
            狀態標籤獨立成 flex 項目、自己一行也不會被壓縮：
            以前跟「單號…狀態：」同一行文字，寬度不夠時標籤會折到第二行並壓到分隔線。
          */}
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground",
              metaText,
            )}
          >
            <span className="whitespace-nowrap">單號：{order.orderNo}</span>
            <span className="whitespace-nowrap">· 狀態：</span>
            <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-card">
              {statusLabel(order.status)}
            </Badge>
          </div>
        </div>
        <div className={cn("text-right", compact ? "text-sm" : "text-base")}>
          <p className="whitespace-nowrap">日期：{order.orderDate}</p>
          {vendorName && (
            <p className={cn("mt-0.5 font-semibold", compact ? "" : "text-lg")}>{vendorName}</p>
          )}
          {singleNote && (
            <p className={cn("mt-0.5 font-semibold text-red-600", compact ? "text-sm" : "text-base")}>
              備註：{singleNote}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-1.5",
          compact ? "mb-2" : "mb-3",
          infoText,
        )}
      >
        <p>
          <span className={cn("text-muted-foreground", labelText)}>客戶名：</span>
          <span className="font-medium">{order.customerName || "—"}</span>
        </p>
        <p>
          <span className={cn("text-muted-foreground", labelText)}>案名：</span>
          <span className="font-medium">{order.projectName || "—"}</span>
        </p>
        <p className="col-span-2">
          <span className={cn("text-muted-foreground", labelText)}>訂單備註：</span>
          <span className="font-medium">{order.notes || "—"}</span>
        </p>
      </div>

      {/* Items */}
      <table className={cn("w-full border-collapse leading-snug", tableText)}>
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <th className={cn("whitespace-nowrap pr-2 font-semibold", compact ? "w-8 py-1" : "w-10 py-1.5")}>項次</th>
            {showVendorColumn && (
              <th className={cn("whitespace-nowrap pr-2 font-semibold", cellY)}>廠商</th>
            )}
            <th className={cn("whitespace-nowrap pr-2 font-semibold", cellY)}>色號</th>
            <th className={cn("whitespace-nowrap pr-2 font-semibold", cellY)}>尺寸</th>
            <th className={cn("whitespace-nowrap pr-2 font-semibold", cellY)}>用量</th>
            <th className={cn("pr-2 font-semibold", cellY)}>規格</th>
            <th className={cn("whitespace-nowrap pr-2 text-right font-semibold", compact ? "w-12 py-1" : "w-14 py-1.5")}>
              數量
            </th>
            <th className={cn("whitespace-nowrap pr-2 text-right font-semibold", compact ? "w-16 py-1" : "w-20 py-1.5")}>
              單價
            </th>
            <th className={cn("font-semibold", cellY)}>備註</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const note = vendorNote(it.vendorId);
            const isNewVendor =
              showVendorColumn && idx > 0 && items[idx - 1].vendorId !== it.vendorId;
            const showNoteRow = showVendorColumn && note && (idx === 0 || isNewVendor);
            // 「強調」：表單上選取的重點字，這裡照著印成紅字／粗體
            const marks = (field: EmphasisField) =>
              it.emphasis?.filter((m) => m.field === field);
            const cell = (extra?: string) => cn("pr-2", cellY, extra);
            return (
              <Fragment key={it.id}>
                {showNoteRow && (
                  <tr className="border-b">
                    <td
                      colSpan={showVendorColumn ? 9 : 8}
                      className={cn(
                        "font-semibold text-red-600",
                        compact ? "py-0.5 text-sm" : "py-1 text-base",
                      )}
                    >
                      備註（{it.vendorName || "廠商"}）：{note}
                    </td>
                  </tr>
                )}
                <tr className="border-b">
                  <td className={cell("whitespace-nowrap text-muted-foreground")}>{idx + 1}</td>
                  {showVendorColumn && (
                    <td className={cell("whitespace-nowrap font-medium")}>{it.vendorName || "—"}</td>
                  )}
                  <td className={cell("whitespace-nowrap font-medium")} data-field="productName" data-item-id={it.id}>
                    {it.productName
                      ? emphasized(it.productName, marks("productName"), `${it.id}-pn`)
                      : "—"}
                  </td>
                  <td className={cell("whitespace-nowrap")} data-field="size" data-item-id={it.id}>
                    {it.size ? emphasized(it.size, marks("size"), `${it.id}-size`) : "—"}
                  </td>
                  <td className={cell("whitespace-nowrap")} data-field="usage" data-item-id={it.id}>
                    {it.usage ? emphasized(it.usage, marks("usage"), `${it.id}-usage`) : "—"}
                  </td>
                  <td className={cell()} data-field="spec" data-item-id={it.id}>
                    {it.spec ? emphasized(it.spec, marks("spec"), `${it.id}-spec`) : "—"}
                  </td>
                  <td className={cell("whitespace-nowrap text-right tabular-nums")}>{it.quantity}</td>
                  <td className={cell("whitespace-nowrap text-right tabular-nums")}>
                    {fmtMoney(toNum(it.unitPrice))}
                  </td>
                  <td className={cell()} data-field="notes" data-item-id={it.id}>
                    {it.notes ? emphasized(it.notes, marks("notes"), `${it.id}-notes`) : "—"}
                  </td>
                </tr>
              </Fragment>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={showVendorColumn ? 9 : 8}
                className="py-6 text-center text-muted-foreground"
              >
                沒有明細
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 出單人 */}
      <div
        className={cn(
          "flex justify-end",
          compact ? "mt-3 text-sm" : "mt-5 text-base",
        )}
      >
        <p>
          出單人：
          {issuer ? (
            <span className="ml-1 font-medium">{issuer}</span>
          ) : (
            <span className="ml-1 inline-block w-28 border-b border-dotted border-foreground/40" />
          )}
        </p>
      </div>
    </div>
  );
}

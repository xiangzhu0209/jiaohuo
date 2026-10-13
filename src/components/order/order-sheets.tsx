import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import OrderSheet from "./order-sheet";

/**
 * Renders one customer's 叫貨單 sheet. All vendors' items are merged into a
 * single sheet (with a 廠商 column) so a customer fits on one page; a sheet
 * flows onto a second page only when there are many items. `singleVendor`
 * renders just one vendor's items for sending to that vendor.
 */
export default function OrderSheets({
  order,
  items,
  singleVendor,
  paper = "a4",
}: {
  order: Order;
  items: OrderItem[];
  singleVendor?: string | null;
  paper?: "a4" | "a5l";
}) {
  const { profileName } = useAuth();
  // 出單人優先使用建立時記錄的姓名（舊單沒有則用目前登入者）
  const issuer = order.createdBy || profileName;

  const visibleItems = useMemo(() => {
    const base = singleVendor
      ? items.filter((it) => it.vendorId === singleVendor)
      : items;

    // 同廠商的明細排在一起：
    // - 廠商之間依「第一次出現」的順序（也就是輸入的先後）
    // - 同一廠商內維持原本輸入的先後順序
    const vendorOrder: string[] = [];
    const grouped = new Map<string, OrderItem[]>();
    for (const it of base) {
      const key = it.vendorId || it.vendorName || "其他";
      const list = grouped.get(key);
      if (list) {
        list.push(it);
      } else {
        vendorOrder.push(key);
        grouped.set(key, [it]);
      }
    }

    const sorted: OrderItem[] = [];
    for (const key of vendorOrder) {
      const list = grouped.get(key);
      if (list) sorted.push(...list);
    }
    return sorted;
  }, [items, singleVendor]);

  const vendorList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      if (it.vendorId && !seen.has(it.vendorId)) {
        seen.set(it.vendorId, it.vendorName ?? "");
      }
    }
    return [...seen.entries()];
  }, [items]);

  const vendorName = singleVendor
    ? items.find((it) => it.vendorId === singleVendor)?.vendorName
    : undefined;

  return (
    <div className="print-sheet">
      <div className="print-hidden mb-1 flex flex-wrap items-center justify-end gap-2 text-xs">
        {singleVendor ? (
          <Link
            to={`/orders/${order.id}/print`}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            印所有廠商
          </Link>
        ) : (
          vendorList.length > 1 && (
            <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>單獨列印：</span>
              {vendorList.map(([vid, name]) => (
                <Link
                  key={vid}
                  to={`/orders/${order.id}/print?vendor=${vid}`}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {name}
                </Link>
              ))}
            </span>
          )
        )}
      </div>
      <OrderSheet
        order={order}
        items={visibleItems}
        issuer={issuer}
        vendorName={vendorName}
        showVendorColumn={!singleVendor}
        paper={paper}
      />
    </div>
  );
}

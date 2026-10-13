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
}: {
  order: Order;
  items: OrderItem[];
  singleVendor?: string | null;
}) {
  const { profileName } = useAuth();
  const issuer = profileName;

  // 將明細進行同廠商群組化，並保持廠商首次出現的順序
  const visibleItems = useMemo(() => {
    const filtered = singleVendor
      ? items.filter((it) => it.vendorId === singleVendor)
      : items;

    const vendorOrder: string[] = [];
    const grouped = new Map<string, OrderItem[]>();

    for (const it of filtered) {
      // 若無 vendorId 則以 vendorName 代替，確保不會報錯
      const key = it.vendorId || it.vendorName || "unknown";
      
      if (!grouped.has(key)) {
        vendorOrder.push(key);
        grouped.set(key, []);
      }
      grouped.get(key)!.push(it);
    }

    const sorted: OrderItem[] = [];
    for (const key of vendorOrder) {
      sorted.push(...grouped.get(key)!);
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
      />
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import OrderSheet from "./order-sheet";

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

  // 1. 如果有指定單一廠商，就只挑選該廠商；如果沒有，就顯示全部項目
  const baseItems = useMemo(() => {
    if (!singleVendor) return items;
    return items.filter(
      (it) => it.vendorId === singleVendor || it.vendorName === singleVendor
    );
  }, [items, singleVendor]);

  // 2. 將明細進行同廠商群組化，並依照首次出現的順序排列
  const visibleItems = useMemo(() => {
    const vendorOrder: string[] = [];
    const grouped = new Map<string, OrderItem[]>();

    for (const it of baseItems) {
      // 優先使用 vendorName 分組，若無則用 vendorId，再沒有就歸類為 "其他"
      const key = it.vendorName || it.vendorId || "其他";
      
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
  }, [baseItems]);

  const vendorList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      const vId = it.vendorId || it.vendorName;
      const vName = it.vendorName || it.vendorId;
      if (vId && vName && !seen.has(vId)) {
        seen.set(vId, vName);
      }
    }
    return [...seen.entries()];
  }, [items]);

  const vendorName = singleVendor
    ? items.find((it) => it.vendorId === singleVendor || it.vendorName === singleVendor)?.vendorName || singleVendor
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

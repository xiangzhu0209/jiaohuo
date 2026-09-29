import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { fetchOrderItemsByOrderIds, fetchOrders } from "@/lib/db";
import type { Order, OrderItem } from "@/lib/types";
import OrderSheets from "@/components/order/order-sheets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BatchPrint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [paper, setPaper] = useState<"a4" | "a5l">("a4");
  const ids = useMemo(
    () => searchParams.get("ids")?.split(",").filter(Boolean) ?? [],
    [searchParams],
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["batch-orders", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const all = await fetchOrders();
      const byId = new Map(all.map((o) => [o.id, o]));
      return ids
        .map((oid) => byId.get(oid))
        .filter((o): o is Order => o !== undefined)
        .sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    },
  });

  const orderIds = useMemo(() => orders.map((o) => o.id), [orders]);

  const { data: items = [] } = useQuery({
    queryKey: ["batch-items", orderIds],
    enabled: orderIds.length > 0,
    queryFn: () => fetchOrderItemsByOrderIds(orderIds),
  });

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const it of items) {
      const list = map.get(it.orderId) ?? [];
      list.push(it);
      map.set(it.orderId, list);
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar (hidden when printing) */}
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-elegant">
        <Button variant="ghost" onClick={() => navigate("/orders")}>
          <ArrowLeft className="size-4" /> 返回叫貨單
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">共 {orders.length} 位客戶</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">紙張</span>
            <Select value={paper} onValueChange={(v) => setPaper(v as "a4" | "a5l")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 直式</SelectItem>
                <SelectItem value="a5l">A5 橫式</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} disabled={orders.length === 0}>
            <Printer className="size-4" /> 列印 / 存成 PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          沒有選取任何叫貨單
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((o) => (
            <OrderSheets key={o.id} order={o} items={itemsByOrder.get(o.id) ?? []} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { fetchOrder, fetchOrderItemsByOrder, updateOrderStatus } from "@/lib/db";
import OrderSheets from "@/components/order/order-sheets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function OrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const vendorParam = searchParams.get("vendor");
  const [paper, setPaper] = useState<"a4" | "a5l">("a4");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-print", id],
    enabled: !!id,
    queryFn: () => fetchOrder(id!),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["order-items", id],
    enabled: !!id,
    queryFn: () => fetchOrderItemsByOrder(id!),
  });

  const markSent = useMutation({
    mutationFn: async () => {
      await updateOrderStatus(id!, "sent");
    },
    onSuccess: () => {
      toast("已標記為「已送出」");
      void qc.invalidateQueries({ queryKey: ["order-print", id] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar (hidden when printing) */}
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-elegant">
        <Button variant="ghost" onClick={() => navigate("/orders")}>
          <ArrowLeft className="size-4" /> 返回叫貨單
        </Button>
        <div className="flex flex-wrap items-center gap-2">
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
          {order && order.status !== "sent" && order.status !== "done" && (
            <Button variant="outline" onClick={() => markSent.mutate()} disabled={markSent.isPending}>
              {markSent.isPending ? "更新中…" : "標記為已送出"}
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> 列印 / 存成 PDF
          </Button>
        </div>
      </div>

      {isLoading || !order ? (
        <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>
      ) : (
        <OrderSheets order={order} items={items} singleVendor={vendorParam} paper={paper} />
      )}
    </div>
  );
}

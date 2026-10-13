import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer, Edit } from "lucide-react";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import OrderSheets from "@/components/order/order-sheets";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [searchParams] = useSearchParams();
  const vendorParam = searchParams.get("vendor");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-print", uid, id],
    enabled: !!uid && !!id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, "orders", id!));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["order-items", uid, id],
    enabled: !!uid && !!id,
    queryFn: async () => {
      const q = query(
        collection(db, "orderItems"),
        where("userId", "==", uid),
        where("orderId", "==", id!),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderItem);
    },
  });

  const markSent = useMutation({
    mutationFn: async () => {
      await updateDoc(doc(db, "orders", id!), {
        status: "sent",
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast("已標記為「已送出」");
      void qc.invalidateQueries({ queryKey: ["order-print", uid, id] });
      void qc.invalidateQueries({ queryKey: ["orders", uid] });
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar (hidden when printing) */}
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/orders")}>
          <ArrowLeft className="size-4" /> 返回叫貨單
        </Button>
        <div className="flex items-center gap-2">
          {/* 新增的「修改訂單」按鈕 */}
          <Button variant="outline" onClick={() => navigate(`/orders/${id}/edit`)}>
            <Edit className="mr-2 size-4" /> 修改訂單
          </Button>

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
        <OrderSheets order={order} items={items} singleVendor={vendorParam} />
      )}
    </div>
  );
}

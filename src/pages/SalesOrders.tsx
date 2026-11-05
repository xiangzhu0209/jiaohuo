import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FilePenLine, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { deleteSalesOrder, fetchMySalesOrders, requestSalesOrderEdit } from "@/lib/sales-db";
import { KIND_LABELS, STATUS_LABELS, type SalesOrder, type SalesStatus } from "@/lib/sales-types";
import { fmtMoney } from "@/lib/order-utils";
import { useAuth } from "@/hooks/use-auth";
import SalesGuard from "@/components/order/sales-guard";
import StatusBadge from "@/components/order/sales-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Filter = "all" | SalesStatus;

function MyOrdersInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null);
  const [requestTarget, setRequestTarget] = useState<SalesOrder | null>(null);
  const [requestReason, setRequestReason] = useState("");

  const { data: orders = [], isLoading, isError, error } = useQuery({
    queryKey: ["sales-orders", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySalesOrders(user!.id),
  });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders.length, draft: 0, submitted: 0, ordered: 0 };
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const submitEditRequest = useMutation({
    mutationFn: async () => {
      if (!requestTarget) throw new Error("請選擇訂單");
      if (!requestReason.trim()) throw new Error("請填寫修改原因");
      await requestSalesOrderEdit(requestTarget.id, requestReason);
    },
    onSuccess: () => {
      toast("修改申請已送出，等待管理者確認");
      setRequestTarget(null);
      setRequestReason("");
      void qc.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (err) => toast(`申請失敗：${(err as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSalesOrder(id),
    onSuccess: () => {
      toast("已刪除草稿");
      void qc.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (err) => toast(`刪除失敗：${(err as Error).message}`),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">我的單</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">自己送出的業務單與草稿</p>
        </div>
        <Button onClick={() => navigate("/sales/new")} className="h-11">
          <Plus className="size-5" /> 新增業務單
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">全部 {counts.all}</TabsTrigger>
          <TabsTrigger value="draft">草稿 {counts.draft}</TabsTrigger>
          <TabsTrigger value="submitted">待下單 {counts.submitted}</TabsTrigger>
          <TabsTrigger value="ordered">已下單 {counts.ordered}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">載入中…</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-destructive">
          讀取失敗：{(error as Error).message}
        </p>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          <ClipboardList className="size-9 opacity-40" />
          {filter === "all" ? "還沒有業務單，按右上角「新增業務單」開始" : `沒有「${STATUS_LABELS[filter]}」的單`}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{o.customerName || "（未填客戶名）"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.orderDate}・{KIND_LABELS[o.kind]}・{o.windows.length} 個窗位
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                {o.total > 0 && (
                  <p className="text-sm tabular-nums text-muted-foreground">
                    總價 {fmtMoney(o.total)}
                    {o.deposit > 0 ? `，訂金 ${fmtMoney(o.deposit)}` : ""}
                  </p>
                )}
                {o.status !== "draft" && (
                  <p className={`text-sm ${o.editRequestStatus === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                    {o.editRequestStatus === "pending"
                      ? `修改申請審核中${o.editRequestReason ? `：${o.editRequestReason}` : ""}`
                      : o.editApproved
                        ? "管理者已核准修改；可編輯，直到管理者重新鎖定。"
                        : o.editRequestStatus === "rejected"
                          ? `管理者已拒絕修改申請${o.editRequestReason ? `：${o.editRequestReason}` : ""}`
                          : "訂單已送出並鎖定。"}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {o.status === "draft" || o.editApproved ? (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/sales/${o.id}/edit`)}>
                      <Pencil className="size-4" /> 編輯
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={o.editRequestStatus === "pending" || submitEditRequest.isPending}
                      onClick={() => {
                        setRequestTarget(o);
                        setRequestReason("");
                      }}
                    >
                      <FilePenLine className="size-4" />
                      {o.editRequestStatus === "pending" ? "申請審核中" : "申請修改"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/sales/print?ids=${o.id}`)}>
                    <Printer className="size-4" /> 預覽／匯出
                  </Button>
                  {o.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(o)}
                    >
                      <Trash2 className="size-4" /> 刪除
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!requestTarget}
        onOpenChange={(open) => {
          if (!open && !submitEditRequest.isPending) setRequestTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>申請修改已送出的訂單</AlertDialogTitle>
            <AlertDialogDescription>
              {requestTarget?.customerName || "這張訂單"} 目前為鎖定狀態。請說明需要修改的內容，管理者核准前無法編輯。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            value={requestReason}
            onChange={(event) => setRequestReason(event.target.value)}
            placeholder="請填寫修改原因或需要調整的內容"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitEditRequest.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitEditRequest.isPending || !requestReason.trim()}
              onClick={(event) => {
                event.preventDefault();
                submitEditRequest.mutate();
              }}
            >
              {submitEditRequest.isPending ? "送出中…" : "送出申請"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這張草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.customerName || "未填客戶名"}」的草稿刪除後無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SalesOrders() {
  return (
    <SalesGuard>
      <MyOrdersInner />
    </SalesGuard>
  );
}

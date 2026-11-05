import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, CheckCheck, Inbox, LockKeyhole, Pencil, Printer, RotateCcw, Search, X } from "lucide-react";
import {
  fetchSalesOrdersByStatus,
  fetchSalesOrdersWithEditRequests,
  lockSalesOrderEdits,
  markSalesOrdered,
  reopenSalesOrders,
  reviewSalesOrderEdit,
} from "@/lib/sales-db";
import { KIND_LABELS, type SalesOrder } from "@/lib/sales-types";
import { fmtMoney } from "@/lib/order-utils";
import { useAuth } from "@/hooks/use-auth";
import SalesGuard from "@/components/order/sales-guard";
import StatusBadge from "@/components/order/sales-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Tab = "submitted" | "ordered" | "modifications";

const stamp = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

function InboxInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profileName, user } = useAuth();
  const [tab, setTab] = useState<Tab>("submitted");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: pending = [], isLoading: loadingPending, isError: pendingError, error: pendingErr } = useQuery({
    queryKey: ["sales-inbox", "submitted"],
    queryFn: () => fetchSalesOrdersByStatus("submitted"),
  });
  const { data: done = [], isLoading: loadingDone, isError: doneError, error: doneErr } = useQuery({
    queryKey: ["sales-inbox", "ordered"],
    enabled: tab === "ordered",
    queryFn: () => fetchSalesOrdersByStatus("ordered"),
  });
  const { data: modificationRequests = [], isLoading: loadingRequests, isError: requestsError, error: requestsErr } = useQuery({
    queryKey: ["sales-inbox", "modifications"],
    queryFn: fetchSalesOrdersWithEditRequests,
  });

  const list = tab === "submitted" ? pending : tab === "ordered" ? done : modificationRequests;
  const loading = tab === "submitted" ? loadingPending : tab === "ordered" ? loadingDone : loadingRequests;
  const isError = tab === "submitted" ? pendingError : tab === "ordered" ? doneError : requestsError;
  const error = tab === "submitted" ? pendingErr : tab === "ordered" ? doneErr : requestsErr;

  const shown = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((o) =>
      [o.customerName, o.phone, o.address, o.person].join(" ").toLowerCase().includes(kw),
    );
  }, [list, search]);

  const shownIds = shown.map((o) => o.id);
  const selectedShown = shownIds.filter((id) => selected.has(id));
  const allSelected = shownIds.length > 0 && selectedShown.length === shownIds.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) shownIds.forEach((id) => next.delete(id));
      else shownIds.forEach((id) => next.add(id));
      return next;
    });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["sales-inbox"] });
    void qc.invalidateQueries({ queryKey: ["sales-orders"] });
    void qc.invalidateQueries({ queryKey: ["sales-print"] });
  };

  const markOrdered = useMutation({
    mutationFn: (ids: string[]) => markSalesOrdered(ids, profileName || user?.email || ""),
    onSuccess: (_d, ids) => {
      toast(`已標記 ${ids.length} 張為已下單`);
      setSelected(new Set());
      refresh();
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  const reopen = useMutation({
    mutationFn: (ids: string[]) => reopenSalesOrders(ids),
    onSuccess: (_d, ids) => {
      toast(`已把 ${ids.length} 張改回待下單`);
      setSelected(new Set());
      refresh();
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  const reviewEdit = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      reviewSalesOrderEdit(id, approved, profileName || user?.email || "管理者"),
    onSuccess: (_result, variables) => {
      toast(variables.approved ? "已核准修改，訂單開放至管理者重新鎖定" : "已拒絕修改申請，訂單維持鎖定");
      refresh();
    },
    onError: (err) => toast(`處理失敗：${(err as Error).message}`),
  });
  const lockEdits = useMutation({
    mutationFn: lockSalesOrderEdits,
    onSuccess: () => {
      toast("已重新鎖定訂單修改權限");
      refresh();
    },
    onError: (err) => toast(`鎖定失敗：${(err as Error).message}`),
  });

  const printIds = (ids: string[], type: "keep" | "install") =>
    navigate(`/sales/print?ids=${ids.join(",")}&type=${type}`);
  const busy = markOrdered.isPending || reopen.isPending || reviewEdit.isPending || lockEdits.isPending;

  const row = (o: SalesOrder) => (
    <Card key={o.id} className={selected.has(o.id) ? "border-primary/60" : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {tab !== "modifications" && (
            <Checkbox
              className="mt-1 size-5"
              checked={selected.has(o.id)}
              onCheckedChange={() => toggle(o.id)}
              aria-label="選取這張單"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-base font-semibold">{o.customerName || "（未填客戶名）"}</p>
              <StatusBadge status={o.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              負責人 {o.person || "—"}・{KIND_LABELS[o.kind]}・{o.windows.length} 個窗位
              {o.total > 0 ? `・總價 ${fmtMoney(o.total)}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {o.orderDate}
              {o.phone ? `・${o.phone}` : ""}
              {tab === "submitted" && o.submittedAt ? `・送出 ${stamp(o.submittedAt)}` : ""}
              {tab === "ordered" && o.orderedAt
                ? `・${stamp(o.orderedAt)} 由 ${o.orderedBy || "管理者"} 下單`
                : ""}
              {tab === "modifications" && o.editRequestAt ? `・申請 ${stamp(o.editRequestAt)}` : ""}
            </p>
            {tab === "modifications" && (
              <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <span className="font-medium">修改原因：</span>{o.editRequestReason || "（未填寫）"}
              </p>
            )}
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 ${tab === "modifications" ? "pl-0" : "pl-8"}`}>
          {tab === "modifications" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => reviewEdit.mutate({ id: o.id, approved: true })}>
                <Check className="size-4" /> 核准修改
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => reviewEdit.mutate({ id: o.id, approved: false })}
              >
                <X className="size-4" /> 拒絕
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/sales/${o.id}/edit`)}>
                <Pencil className="size-4" /> 查看訂單
              </Button>
            </>
          ) : (
            <>
          <Button variant="outline" size="sm" onClick={() => printIds([o.id], "keep")}>
            <Printer className="size-4" /> 留存單
          </Button>
          <Button variant="outline" size="sm" onClick={() => printIds([o.id], "install")}>
            <Printer className="size-4" /> 安裝單
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/sales/${o.id}/edit`)}>
            <Pencil className="size-4" /> 編輯
          </Button>
          {tab === "submitted" ? (
            <Button size="sm" disabled={busy} onClick={() => markOrdered.mutate([o.id])}>
              <CheckCheck className="size-4" /> 標記已下單
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => reopen.mutate([o.id])}>
              <RotateCcw className="size-4" /> 改回待下單
            </Button>
          )}
          {o.editApproved && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => lockEdits.mutate(o.id)}
            >
              <LockKeyhole className="size-4" /> 重新鎖定修改
            </Button>
          )}
          </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">待下單區</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          管理業務送來的訂單、審核修改申請，並可列印、標記已下單或重新鎖定修改權限
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setSelected(new Set());
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="submitted">待下單 {pending.length}</TabsTrigger>
          <TabsTrigger value="ordered">已下單</TabsTrigger>
          <TabsTrigger value="modifications">修改申請 {modificationRequests.length}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9 text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋客戶、電話、地址、負責人"
        />
      </div>

      {shown.length > 0 && tab !== "modifications" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            全選
          </label>
          <span className="text-sm text-muted-foreground">已選 {selectedShown.length} 張</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedShown.length === 0}
              onClick={() => printIds(selectedShown, "keep")}
            >
              <Printer className="size-4" /> 留存單
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedShown.length === 0}
              onClick={() => printIds(selectedShown, "install")}
            >
              <Printer className="size-4" /> 安裝單
            </Button>
            {tab === "submitted" ? (
              <Button
                size="sm"
                disabled={selectedShown.length === 0 || busy}
                onClick={() => markOrdered.mutate(selectedShown)}
              >
                <CheckCheck className="size-4" /> 標記已下單
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={selectedShown.length === 0 || busy}
                onClick={() => reopen.mutate(selectedShown)}
              >
                <RotateCcw className="size-4" /> 改回待下單
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">載入中…</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-destructive">
          讀取失敗：{(error as Error).message}
        </p>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          <Inbox className="size-9 opacity-40" />
          {search.trim()
            ? "沒有符合搜尋的單"
            : tab === "submitted"
              ? "目前沒有待下單的單"
              : tab === "ordered"
                ? "還沒有已下單的單"
                : "目前沒有待審核的修改申請"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">{shown.map(row)}</div>
      )}
    </div>
  );
}

export default function SalesInbox() {
  return (
    <SalesGuard adminOnly>
      <InboxInner />
    </SalesGuard>
  );
}

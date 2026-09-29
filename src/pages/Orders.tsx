import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Calculator, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import {
  deleteOrder,
  fetchOrderItemsByOrderIds,
  fetchOrders,
  fetchVendors,
  updateOrderStatus,
} from "@/lib/db";
import type { Order, OrderItem } from "@/lib/types";
import { currentMonth, monthRange, STATUS_LABELS } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { cn } from "@/lib/utils";

const statusVariant = (status: string) =>
  cn(
    "border-transparent font-medium",
    status === "sent" && "bg-primary text-primary-foreground",
    status === "done" && "bg-success text-success-foreground",
    status === "draft" && "bg-muted text-muted-foreground",
  );

export default function Orders() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [vendorId, setVendorId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const range = monthRange(month);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const monthOrders = useMemo(
    () =>
      orders.filter((o) => o.orderDate >= range.start && o.orderDate <= range.end),
    [orders, range],
  );

  const monthIds = useMemo(() => monthOrders.map((o) => o.id), [monthOrders]);

  const { data: monthItems = new Map<string, OrderItem[]>() } = useQuery({
    queryKey: ["order-vendor-items", monthIds],
    enabled: monthIds.length > 0,
    queryFn: async () => {
      const items = await fetchOrderItemsByOrderIds(monthIds);
      const byOrder = new Map<string, OrderItem[]>();
      for (const it of items) {
        const list = byOrder.get(it.orderId) ?? [];
        list.push(it);
        byOrder.set(it.orderId, list);
      }
      return byOrder;
    },
  });

  const vendorNamesByOrder = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [orderId, items] of monthItems) {
      const names = [...new Set(items.map((it) => it.vendorName).filter(Boolean))];
      map.set(orderId, names);
    }
    return map;
  }, [monthItems]);

  const vendorIdsByOrder = useMemo(() => {
    const map = new Map<string, Set<string | null>>();
    for (const [orderId, items] of monthItems) {
      map.set(orderId, new Set(items.map((it) => it.vendorId)));
    }
    return map;
  }, [monthItems]);

  const filtered = useMemo(() => {
    const kw = search.trim();
    return monthOrders.filter((o) => {
      if (vendorId !== "all" && !vendorIdsByOrder.get(o.id)?.has(vendorId)) return false;
      if (status !== "all" && o.status !== status) return false;
      if (kw) {
        const hay = [o.orderNo, o.customerName, o.projectName].join(" ").toLowerCase();
        if (!hay.includes(kw.toLowerCase())) return false;
      }
      return true;
    });
  }, [monthOrders, vendorId, status, search, vendorIdsByOrder]);

  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteOrder(id);
    },
    onSuccess: () => {
      toast("叫貨單已刪除");
      setDeleteTarget(null);
      setSelected((prev) => {
        if (!deleteTarget || !prev.has(deleteTarget.id)) return prev;
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => toast(`刪除失敗：${(err as Error).message}`),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateOrderStatus(id, status);
    },
    onSuccess: () => {
      toast("狀態已更新");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  const printSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    navigate(`/orders/print?ids=${ids.join(",")}`);
  };

  const vendorNames = (o: Order) => {
    const names = vendorNamesByOrder.get(o.id);
    return names && names.length > 0 ? names.join("、") : "—";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">叫貨單</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            一位客戶一單，內含各廠商要叫的貨
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printSelected} disabled={selected.size === 0}>
            <Printer className="size-4" /> 列印選取{selected.size > 0 ? `（${selected.size}）` : ""}
          </Button>
          <Button onClick={() => navigate("/orders/new")}>
            <Plus className="size-4" /> 新增叫貨單
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">訂單列表</CardTitle>
              <CardDescription>月份：{month}</CardDescription>
            </div>
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-text print-hidden">
              共 {filtered.length} 張
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
            />
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部廠商</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="sent">已送出</SelectItem>
                <SelectItem value="done">已完成</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜尋單號 / 客戶 / 案名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">載入中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              這個月份還沒有叫貨單
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleAll}
                        aria-label="全選"
                      />
                    </TableHead>
                    <TableHead>單號</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>客戶</TableHead>
                    <TableHead className="hidden md:table-cell">案名</TableHead>
                    <TableHead>廠商</TableHead>
                    <TableHead className="hidden sm:table-cell">出單人</TableHead>
                    <TableHead className="hidden sm:table-cell">狀態</TableHead>
                    <TableHead className="w-28 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id} className={cn(selected.has(o.id) && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(o.id)}
                          onCheckedChange={() => toggleOne(o.id)}
                          aria-label="選取"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                      <TableCell>{o.orderDate}</TableCell>
                      <TableCell className="font-medium">{o.customerName || "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {o.projectName || "—"}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate">{vendorNames(o)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{o.createdBy || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Select
                          value={o.status}
                          onValueChange={(v) => statusMutation.mutate({ id: o.id, status: v })}
                        >
                          <SelectTrigger className={cn("h-7 w-[5.5rem]", statusVariant(o.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="列印" onClick={() => navigate(`/orders/${o.id}/print`)}>
                            <Printer className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="編輯" onClick={() => navigate(`/orders/${o.id}/edit`)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="刪除" onClick={() => setDeleteTarget(o)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-end border-t border-border/70 pt-4">
              <Button variant="ghost" onClick={() => navigate("/reconciliation")}>
                <Calculator className="size-4" /> 到月對帳
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除叫貨單？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.orderNo}」（{deleteTarget?.customerName || "無客戶"}）嗎？
              所有廠商的明細將一併刪除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

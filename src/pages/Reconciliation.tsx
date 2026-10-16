import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, ChevronDown, Printer } from "lucide-react";
import { fetchAllOrderItems, fetchVendors, setItemsSettled } from "@/lib/db";
import type { OrderItem } from "@/lib/types";
import { currentMonth, fmtMoney, monthRange, toNum } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Group {
  key: string;
  vendorName: string;
  productName: string;
  size: string;
  spec: string;
  rows: OrderItem[];
  totalQty: number;
  priceLabel: string;
  /** 這個品項本月最早叫貨的日期，用來做日期排序 */
  firstDate: string;
}

type SortKey = "date-asc" | "date-desc" | "vendor";
type StatusKey = "all" | "unsettled" | "settled";

const SORT_LABELS: Record<SortKey, string> = {
  "date-asc": "日期：由早到晚",
  "date-desc": "日期：由晚到早",
  vendor: "廠商／色號",
};

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "全部",
  unsettled: "未結清",
  settled: "已結清",
};

/** 列印用的結清欄位：已結清打勾，未結清留空框好讓人在紙上畫記。 */
const settleMark = (settled: boolean): string => (settled ? "✓" : "□");

export default function Reconciliation() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [vendorId, setVendorId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date-asc");
  const [status, setStatus] = useState<StatusKey>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  // 剛勾選的明細先記在這裡，畫面馬上反應，雲端寫入完成後才交還給查詢結果
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const range = monthRange(month);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["reconciliation", month],
    queryFn: fetchAllOrderItems,
  });

  const isSettled = useCallback(
    (it: OrderItem): boolean => pending[it.id] ?? it.settled === true,
    [pending],
  );

  const saveSettled = useMutation({
    mutationFn: (updates: { id: string; settled: boolean }[]) => setItemsSettled(updates),
    onSuccess: async (_data, updates) => {
      // 先等重新讀取完成，再把樂觀狀態還給雲端資料，畫面才不會閃回去
      await qc.invalidateQueries({ queryKey: ["reconciliation"] });
      setPending((prev) => {
        const next = { ...prev };
        for (const u of updates) if (next[u.id] === u.settled) delete next[u.id];
        return next;
      });
    },
    onError: (err) => {
      setPending({});
      toast(`結清狀態更新失敗：${(err as Error).message}`);
    },
  });

  /** 勾選／取消勾選一批明細（畫面先更新，之後才寫回雲端）。 */
  const applySettled = (updates: { id: string; settled: boolean }[]) => {
    if (updates.length === 0) return;
    setPending((prev) => ({
      ...prev,
      ...Object.fromEntries(updates.map((u) => [u.id, u.settled])),
    }));
    saveSettled.mutate(updates);
  };

  const monthItems = useMemo(
    () =>
      items.filter(
        (it) =>
          it.orderDate >= range.start &&
          it.orderDate <= range.end &&
          (vendorId === "all" || it.vendorId === vendorId),
      ),
    [items, range, vendorId],
  );

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const row of monthItems) {
      const key = `${row.vendorId ?? ""}||${row.productName}||${row.size ?? ""}||${row.spec ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
        existing.totalQty += toNum(row.quantity);
      } else {
        map.set(key, {
          key,
          vendorName: row.vendorName || "未指定廠商",
          productName: row.productName,
          size: row.size ?? "",
          spec: row.spec ?? "",
          rows: [row],
          totalQty: toNum(row.quantity),
          priceLabel: "",
          firstDate: row.orderDate ?? "",
        });
      }
    }
    // 每一組的明細依選定的方向排序（同一天再依單號），對帳時才能照日期逐筆核對
    const dir = sortBy === "date-desc" ? -1 : 1;
    for (const g of map.values()) {
      g.rows.sort(
        (a, b) =>
          dir *
          (a.orderDate.localeCompare(b.orderDate) ||
            a.orderNo.localeCompare(b.orderNo)),
      );
      g.firstDate = g.rows.reduce(
        (min, r) => (r.orderDate && r.orderDate < min ? r.orderDate : min),
        g.rows[0].orderDate ?? "",
      );
    }
    const byVendor = (a: Group, b: Group) =>
      `${a.vendorName}${a.productName}`.localeCompare(`${b.vendorName}${b.productName}`);
    return [...map.values()]
      .map((g) => ({
        ...g,
        priceLabel: [...new Set(g.rows.map((r) => toNum(r.unitPrice)))]
          .sort((a, b) => a - b)
          .map(fmtMoney)
          .join(" / "),
      }))
      .sort((a, b) => {
        if (sortBy === "vendor") return byVendor(a, b);
        const byDate = a.firstDate.localeCompare(b.firstDate);
        // 日期相同時，仍依廠商／色號排，順序才不會跳來跳去
        return (byDate !== 0 ? dir * byDate : 0) || byVendor(a, b);
      });
  }, [monthItems, sortBy]);

  // 未結清的定義：這一組只要還有明細沒勾，就算未結清（部分結清也算）
  const visibleGroups = useMemo(() => {
    if (status === "all") return groups;
    return groups.filter((g) => {
      const done = g.rows.filter(isSettled).length;
      return status === "settled" ? done === g.rows.length : done < g.rows.length;
    });
  }, [groups, status, isSettled]);

  const totalQty = visibleGroups.reduce((s, g) => s + g.totalQty, 0);
  const settledGroupCount = visibleGroups.filter(
    (g) => g.rows.every(isSettled),
  ).length;
  const vendorName = vendors.find((v) => v.id === vendorId)?.name ?? "全部廠商";

  return (
    <div className="flex flex-col gap-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">月對帳</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            依品項統計每月向廠商叫貨的數量與單價，並記錄是否已結清
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> 列印對帳單
        </Button>
      </div>

      <Card>
        <CardHeader className="print-hidden gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">對帳統計</CardTitle>
              <CardDescription>
                {month} · {vendorName} · {SORT_LABELS[sortBy]} · {STATUS_LABELS[status]}
              </CardDescription>
            </div>
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-text">
              共 {visibleGroups.length} 項・已結清 {settledGroupCount} 項・總數量 {totalQty}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} />
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as StatusKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    顯示：{STATUS_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={visibleGroups.length === 0 || saveSettled.isPending}
              onClick={() =>
                applySettled(
                  visibleGroups.flatMap((g) =>
                    g.rows.filter((r) => !isSettled(r)).map((r) => ({ id: r.id, settled: true })),
                  ),
                )
              }
            >
              全部勾選已結清
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={visibleGroups.length === 0 || saveSettled.isPending}
              onClick={() =>
                applySettled(
                  visibleGroups.flatMap((g) =>
                    g.rows.filter((r) => isSettled(r)).map((r) => ({ id: r.id, settled: false })),
                  ),
                )
              }
            >
              全部取消
            </Button>
            <span className="text-xs text-muted-foreground">
              只作用在目前顯示的項目；勾選主列＝整列都算結清，展開後可單筆調整
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">載入中…</p>
          ) : visibleGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Calculator className="mx-auto mb-3 size-8 opacity-30" />
              {groups.length === 0 ? "這個月份還沒有叫貨紀錄" : "沒有符合篩選條件的項目"}
            </div>
          ) : (
            <div>
              <Table className="print:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">結清</TableHead>
                    <TableHead>廠商</TableHead>
                    <TableHead>色號</TableHead>
                    <TableHead>尺寸</TableHead>
                    <TableHead>規格</TableHead>
                    <TableHead className="text-right">數量合計</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroups.map((g) => (
                    <FragmentRow
                      key={g.key}
                      group={g}
                      expanded={expanded === g.key}
                      onToggle={() => setExpanded(expanded === g.key ? null : g.key)}
                      isSettled={isSettled}
                      onSetGroupSettled={(settled) =>
                        applySettled(
                          g.rows
                            .filter((r) => isSettled(r) !== settled)
                            .map((r) => ({ id: r.id, settled })),
                        )
                      }
                      onSetLineSettled={(row, settled) =>
                        applySettled([{ id: row.id, settled }])
                      }
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center justify-between border-t-2 border-primary/20 pt-4">
                <span className="text-sm text-muted-foreground print:text-base">
                  總計 {visibleGroups.length} 項（已結清 {settledGroupCount} 項）
                </span>
                <span className="text-sm text-muted-foreground print:text-base">
                  總數量 <span className="font-semibold tabular-nums text-foreground">{totalQty}</span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FragmentRow({
  group,
  expanded,
  onToggle,
  isSettled,
  onSetGroupSettled,
  onSetLineSettled,
}: {
  group: Group;
  expanded: boolean;
  onToggle: () => void;
  isSettled: (it: OrderItem) => boolean;
  onSetGroupSettled: (settled: boolean) => void;
  onSetLineSettled: (row: OrderItem, settled: boolean) => void;
}) {
  const done = group.rows.filter(isSettled).length;
  const allDone = done === group.rows.length;
  const settledQty = group.rows
    .filter(isSettled)
    .reduce((n, r) => n + toNum(r.quantity), 0);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <span className="flex items-center gap-1.5">
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox
                aria-label="整列結清"
                className="print:hidden"
                checked={allDone ? true : done > 0 ? "indeterminate" : false}
                onCheckedChange={(v) => onSetGroupSettled(v === true)}
              />
            </span>
            <span className="hidden print:inline">{settleMark(allDone)}</span>
            {!allDone && done > 0 && (
              <span className="text-xs text-muted-foreground print:hidden">
                {done}/{group.rows.length}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="max-w-[7rem] truncate">{group.vendorName}</TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            {group.productName}
          </span>
        </TableCell>
        <TableCell>{group.size || "—"}</TableCell>
        <TableCell className="text-muted-foreground">{group.spec || "—"}</TableCell>
        <TableCell className="text-right tabular-nums">{group.totalQty}</TableCell>
        <TableCell className="text-right tabular-nums">{group.priceLabel || "—"}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/40">
          <TableCell colSpan={7} className="px-4 py-2">
            <div className="grid grid-cols-[1.6rem_1.1fr_1.2fr_1.2fr_0.7fr_0.7fr] gap-2 pb-1.5 text-xs font-medium text-muted-foreground">
              <span>結清</span>
              <span>日期</span>
              <span>單號</span>
              <span>客戶</span>
              <span className="text-right">數量</span>
              <span className="text-right">單價</span>
            </div>
            {group.rows.map((r) => {
              const lineSettled = isSettled(r);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.6rem_1.1fr_1.2fr_1.2fr_0.7fr_0.7fr] items-center gap-2 border-t py-1.5 text-sm"
                >
                  <span>
                    <Checkbox
                      aria-label="這筆已結清"
                      className="print:hidden"
                      checked={lineSettled}
                      onCheckedChange={(v) => onSetLineSettled(r, v === true)}
                    />
                    <span className="hidden print:inline">{settleMark(lineSettled)}</span>
                  </span>
                  <span>{r.orderDate}</span>
                  <span className="font-mono text-xs">{r.orderNo}</span>
                  <span className="truncate">{r.customerName || "—"}</span>
                  <span className="text-right tabular-nums">{r.quantity}</span>
                  <span className="text-right tabular-nums">{fmtMoney(toNum(r.unitPrice))}</span>
                </div>
              );
            })}
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground print:text-sm">
              已結清 {done}／{group.rows.length} 筆・已結清數量 {settledQty}／{group.totalQty}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

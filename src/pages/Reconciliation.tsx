import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, ChevronDown, Printer } from "lucide-react";
import { fetchAllOrderItems, fetchVendors } from "@/lib/db";
import type { OrderItem } from "@/lib/types";
import { currentMonth, fmtMoney, monthRange, toNum } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Group {
  key: string;
  vendorName: string;
  productName: string;
  size: string;
  spec: string;
  rows: OrderItem[];
  totalQty: number;
  priceLabel: string;
}

export default function Reconciliation() {
  const [month, setMonth] = useState(currentMonth());
  const [vendorId, setVendorId] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const range = monthRange(month);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["reconciliation", month],
    queryFn: fetchAllOrderItems,
  });

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
        });
      }
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        priceLabel: [...new Set(g.rows.map((r) => toNum(r.unitPrice)))]
          .sort((a, b) => a - b)
          .map(fmtMoney)
          .join(" / "),
      }))
      .sort((a, b) =>
        `${a.vendorName}${a.productName}`.localeCompare(`${b.vendorName}${b.productName}`),
      );
  }, [monthItems]);

  const totalQty = groups.reduce((s, g) => s + g.totalQty, 0);
  const vendorName = vendors.find((v) => v.id === vendorId)?.name ?? "全部廠商";

  return (
    <div className="flex flex-col gap-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">月對帳</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            依品項統計每月向廠商叫貨的數量與單價
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
                {month} · {vendorName}
              </CardDescription>
            </div>
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-text">
              共 {groups.length} 項・總數量 {totalQty}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">載入中…</p>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Calculator className="mx-auto mb-3 size-8 opacity-30" />
              這個月份還沒有叫貨紀錄
            </div>
          ) : (
            <div>
              <Table className="print:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>廠商</TableHead>
                    <TableHead>色號</TableHead>
                    <TableHead>尺寸</TableHead>
                    <TableHead>規格</TableHead>
                    <TableHead className="text-right">數量合計</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <FragmentRow
                      key={g.key}
                      group={g}
                      expanded={expanded === g.key}
                      onToggle={() => setExpanded(expanded === g.key ? null : g.key)}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center justify-between border-t-2 border-primary/20 pt-4">
                <span className="text-sm text-muted-foreground print:text-base">總計 {groups.length} 項</span>
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
}: {
  group: Group;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
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
          <TableCell colSpan={6} className="px-4 py-2">
            <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.7fr_0.7fr] gap-2 pb-1.5 text-xs font-medium text-muted-foreground">
              <span>日期</span>
              <span>單號</span>
              <span>客戶</span>
              <span className="text-right">數量</span>
              <span className="text-right">單價</span>
            </div>
            {group.rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.7fr_0.7fr] gap-2 border-t py-1.5 text-sm"
              >
                <span>{r.orderDate}</span>
                <span className="self-center font-mono text-xs">{r.orderNo}</span>
                <span className="truncate">{r.customerName || "—"}</span>
                <span className="text-right tabular-nums">{r.quantity}</span>
                <span className="text-right tabular-nums">{fmtMoney(toNum(r.unitPrice))}</span>
              </div>
            ))}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

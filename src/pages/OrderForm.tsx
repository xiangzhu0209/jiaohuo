import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Copy, Plus, Save, Trash2, X } from "lucide-react";
import {
  createOrder,
  fetchAllOrderItems,
  fetchAllPrices,
  fetchOrder,
  fetchOrderItemsByOrder,
  fetchPrices,
  fetchVendors,
  nextOrderNo,
  replaceOrderItems,
  updateOrder,
  upsertPrices,
  type ItemInsert,
} from "@/lib/db";
import type { OrderItem, OrderItemDraft, PriceItem } from "@/lib/types";
import { fmtMoney, STATUS_LABELS, toNum } from "@/lib/order-utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VendorSection {
  vendorId: string;
  rows: OrderItemDraft[];
  note: string;
  sameColor: boolean;
}

const newDraft = (): OrderItemDraft => ({
  key: crypto.randomUUID(),
  product_name: "",
  size: "",
  usage: "",
  spec: "",
  quantity: "",
  unit_price: "",
  notes: "",
});

export default function OrderForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profileName } = useAuth();

  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<VendorSection[]>([]);
  const [picker, setPicker] = useState<{ sectionIndex: number; rowKey: string } | null>(null);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vendors) map.set(v.id, v.name);
    return map;
  }, [vendors]);

  const pricesVendorId = picker ? (sections[picker.sectionIndex]?.vendorId ?? "") : "";

  const { data: prices = [] } = useQuery({
    queryKey: ["prices", pricesVendorId],
    enabled: !!pricesVendorId,
    queryFn: () => fetchPrices(pricesVendorId),
  });

  // History of every 色號's most recent unit price (per vendor), used to
  // auto-fill the 單價 when a previously-used 色號 is typed again.
  const { data: priceHistory = [] } = useQuery({
    queryKey: ["price-history"],
    queryFn: fetchAllOrderItems,
  });

  // 價格表本身也作為帶價來源（顏色只存在價格表、尚未叫過貨也能帶入）。
  const { data: priceListAll = [] } = useQuery({
    queryKey: ["price-list-all"],
    queryFn: fetchAllPrices,
  });

  const latestPriceByKey = useMemo(() => {
    const map = new Map<string, number>();
    // 1) 價格表為準（目前定價）
    for (const p of priceListAll) {
      const price = toNum(p.unitPrice);
      if (price <= 0) continue;
      const key = `${p.vendorId || ""}||${(p.productName ?? "").toLowerCase()}`;
      if (!map.has(key)) map.set(key, price);
    }
    // 2) 訂單歷史補缺（價格表沒有的色號，取最近一次單價）
    const sorted = [...priceHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const it of sorted) {
      const price = toNum(it.unitPrice);
      if (price <= 0) continue;
      const key = `${it.vendorId ?? ""}||${(it.productName ?? "").toLowerCase()}`;
      if (!map.has(key)) map.set(key, price);
    }
    return map;
  }, [priceListAll, priceHistory]);

  /** 色號查價金鑰（不分大小寫） */
  const priceKey = (vendorId: string | null | undefined, name: string) =>
    `${vendorId ?? ""}||${name.trim().toLowerCase()}`;

  // Load existing order (edit mode)
  const { isLoading: loadingOrder } = useQuery({
    queryKey: ["order", id],
    enabled: isEdit,
    queryFn: async () => {
      const order = await fetchOrder(id!);
      if (!order) throw new Error("找不到這張叫貨單");
      const orderItems = await fetchOrderItemsByOrder(id!);

      setOrderDate(order.orderDate);
      setCustomerName(order.customerName ?? "");
      setProjectName(order.projectName ?? "");
      setStatus(order.status);
      setNotes(order.notes ?? "");

      const vendorNotes = order.vendorNotes ?? {};
      const groups = new Map<string, OrderItemDraft[]>();
      for (const it of orderItems) {
        const key = it.vendorId ?? "";
        const list = groups.get(key) ?? [];
        list.push({
          key: crypto.randomUUID(),
          product_name: it.productName,
          size: it.size ?? "",
          usage: it.usage ?? "",
          spec: it.spec ?? "",
          quantity: String(it.quantity),
          unit_price: String(it.unitPrice),
          notes: it.notes ?? "",
        });
        groups.set(key, list);
      }
      setSections(
        [...groups.entries()].map(([vendorId, rows]) => ({
          vendorId,
          rows,
          note: vendorNotes[vendorId] ?? "",
          sameColor: false,
        })),
      );
      return order;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vendorNotes: Record<string, string> = {};
      for (const s of sections) {
        if (s.vendorId && s.note.trim()) vendorNotes[s.vendorId] = s.note.trim();
      }
      const base = {
        orderDate,
        customerName: customerName.trim(),
        projectName: projectName.trim(),
        status,
        notes: notes.trim(),
        vendorNotes,
      };

      let orderId: string;
      let orderNo: string;
      if (isEdit) {
        orderId = id!;
        const current = await fetchOrder(id!);
        if (!current) throw new Error("找不到這張叫貨單");
        orderNo = current.orderNo;
        await updateOrder(orderId, base);
      } else {
        orderNo = await nextOrderNo(orderDate);
        orderId = await createOrder({ ...base, orderNo, createdBy: profileName });
      }

      const items: ItemInsert[] = sections.flatMap((s) =>
        s.rows
          .filter((r) => r.product_name.trim() !== "")
          .map((r) => {
            const historyPrice = latestPriceByKey.get(priceKey(s.vendorId, r.product_name));
            return {
              orderId,
              orderNo,
              orderDate,
              customerName: customerName.trim(),
              vendorId: s.vendorId || null,
              vendorName: s.vendorId ? (vendorNameById.get(s.vendorId) ?? "") : "",
              productName: r.product_name.trim(),
              size: r.size.trim(),
              usage: r.usage.trim(),
              spec: r.spec.trim(),
              quantity: Number(r.quantity) || 0,
              unitPrice: Number(r.unit_price) || historyPrice || 0,
              notes: r.notes.trim(),
            };
          }),
      );

      await replaceOrderItems(orderId, items);
      await upsertPrices(items);
      return orderId;
    },
    onSuccess: (createdId) => {
      toast(isEdit ? "叫貨單已更新" : "叫貨單已建立");
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["price-history"] });
      navigate(`/orders/${createdId}/print`);
    },
    onError: (err) => toast(`儲存失敗：${(err as Error).message}`),
  });

  const updateSectionVendor = (sectionIndex: number, vendorId: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, vendorId } : s)),
    );
  };

  const updateItem = (sectionIndex: number, key: string, patch: Partial<OrderItemDraft>) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        // 勾選「整單色號相同」時，改色號會同步到該區塊所有列
        const color = patch.product_name?.trim() ?? "";
        const syncColor = s.sameColor && color !== "";
        return {
          ...s,
          rows: s.rows.map((r) =>
            syncColor
              ? { ...r, ...patch, product_name: color }
              : r.key === key
                ? { ...r, ...patch }
                : r,
          ),
        };
      }),
    );
  };

  const removeItem = (sectionIndex: number, key: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, rows: s.rows.filter((r) => r.key !== key) } : s,
      ),
    );
  };

  const removeSection = (sectionIndex: number) => {
    setSections((prev) => prev.filter((_, i) => i !== sectionIndex));
  };

  const addSection = () => {
    setSections((prev) => [...prev, { vendorId: "", rows: [newDraft()], note: "", sameColor: false }]);
  };

  const addRow = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const next = newDraft();
        // 勾選「整單色號相同」時，新增明細自動帶入目前的色號
        if (s.sameColor) {
          const color = s.rows.find((r) => r.product_name.trim() !== "")?.product_name;
          if (color) next.product_name = color;
        }
        return { ...s, rows: [...s.rows, next] };
      }),
    );
  };

  /** 複製該區塊最後一筆「有內容」的明細（全部欄位，含數量） */
  const duplicateLastRow = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const last = [...s.rows].reverse().find((r) => r.product_name.trim() !== "");
        const copy = last
          ? { ...newDraft(), ...last, key: crypto.randomUUID() }
          : newDraft();
        return { ...s, rows: [...s.rows, copy] };
      }),
    );
  };

  const updateSectionNote = (sectionIndex: number, note: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, note } : s)),
    );
  };

  const toggleSameColor = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, sameColor: !s.sameColor } : s)),
    );
  };

  const addRowFromPrice = (sectionIndex: number) => {
    const key = crypto.randomUUID();
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? { ...s, rows: [...s.rows, { ...newDraft(), key }] }
          : s,
      ),
    );
    setPicker({ sectionIndex, rowKey: key });
  };

  const applyPrice = (p: PriceItem) => {
    if (!picker) return;
    updateItem(picker.sectionIndex, picker.rowKey, {
      product_name: p.productName,
      spec: p.spec ?? "",
      unit_price: String(p.unitPrice),
    });
    setPicker(null);
  };

  // When a previously-used 色號 is typed, fill in the last unit price for that
  // vendor + 色號 (only when the price field is still empty).
  const autoFillPrice = (sectionIndex: number, key: string) => {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const row = s.rows.find((r) => r.key === key);
        if (!row) return s;
        const name = row.product_name.trim();
        if (!name || row.unit_price !== "") return s;
        const price = latestPriceByKey.get(priceKey(s.vendorId, name));
        if (price === undefined) return s;
        return {
          ...s,
          rows: s.rows.map((r) =>
            r.key === key ? { ...r, unit_price: String(price) } : r,
          ),
        };
      }),
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const issues: string[] = [];
    sections.forEach((s, i) => {
      const hasItems = s.rows.some((r) => r.product_name.trim() !== "");
      if (hasItems && !s.vendorId) issues.push(`第 ${i + 1} 個廠商區塊尚未選擇廠商`);
    });
    const totalRows = sections.reduce(
      (n, s) => n + s.rows.filter((r) => r.product_name.trim() !== "").length,
      0,
    );
    if (issues.length > 0) {
      toast(issues.join("；"));
      return;
    }
    if (totalRows === 0) {
      toast("請至少加入一筆明細");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {loadingOrder ? (
        <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/orders")}>
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isEdit ? "編輯叫貨單" : "新增叫貨單"}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  先填客戶資料，再依廠商分開輸入要叫的貨
                </p>
              </div>
            </div>
            <Button type="submit" disabled={saveMutation.isPending || !user}>
              <Save className="size-4" />
              {saveMutation.isPending ? "儲存中…" : "儲存叫貨單"}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">客戶資料</CardTitle>
              <CardDescription>日期與客戶資訊</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-date">日期 *</Label>
                <Input
                  id="o-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-customer">客戶名</Label>
                <Input
                  id="o-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="例如：賴韶宜"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-project">案名</Label>
                <Input
                  id="o-project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例如：中和路"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>狀態</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
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
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="o-notes">訂單備註</Label>
                <Input
                  id="o-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：急件 / 先送一半"
                />
              </div>
            </CardContent>
          </Card>

          {sections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input/70 bg-muted/20 py-12">
              <p className="text-sm text-muted-foreground">
                還沒有廠商區塊，先新增要叫貨的廠商
              </p>
              <Button type="button" variant="outline" onClick={addSection}>
                <Plus className="size-4" /> 新增廠商區塊
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sections.map((sec, si) => (
                <Card key={si} className="overflow-hidden">
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-border/70 bg-muted/40">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Label>廠商 *</Label>
                        <Select value={sec.vendorId} onValueChange={(v) => updateSectionVendor(si, v)}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="選擇廠商" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={sec.sameColor}
                          onCheckedChange={() => toggleSameColor(si)}
                        />
                        整單色號相同
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => duplicateLastRow(si)}>
                        <Copy className="size-4" /> 複製上一項
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => addRow(si)}>
                        <Plus className="size-4" /> 新增明細
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addRowFromPrice(si)}
                      >
                        <BookOpen className="size-4" /> 從價格表帶入
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="移除此廠商區塊"
                        onClick={() => removeSection(si)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {sec.rows.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        此廠商還沒有明細
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="min-w-[720px]">
                          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.6fr_0.8fr_1fr_2rem] gap-2 border-b border-border/70 pb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                            <span>色號</span>
                            <span>尺寸</span>
                            <span>用量</span>
                            <span>規格</span>
                            <span className="text-right">數量</span>
                            <span className="text-right">單價</span>
                            <span>備註</span>
                            <span />
                          </div>
                          {sec.rows.map((it) => (
                            <div
                              key={it.key}
                              className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.6fr_0.8fr_1fr_2rem] items-center gap-2 border-b border-border/60 py-2 transition-colors last:border-b-0 hover:bg-muted/40"
                            >
                              <Input
                                value={it.product_name}
                                onChange={(e) => {
                                  updateItem(si, it.key, { product_name: e.target.value });
                                  autoFillPrice(si, it.key);
                                }}
                                onBlur={() => autoFillPrice(si, it.key)}
                                placeholder="色號"
                              />
                              <Input
                                value={it.size}
                                onChange={(e) => updateItem(si, it.key, { size: e.target.value })}
                                placeholder="尺寸"
                              />
                              <Input
                                value={it.usage}
                                onChange={(e) => updateItem(si, it.key, { usage: e.target.value })}
                                placeholder="用量"
                              />
                              <Input
                                value={it.spec}
                                onChange={(e) => updateItem(si, it.key, { spec: e.target.value })}
                                placeholder="規格"
                              />
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={it.quantity}
                                onChange={(e) => updateItem(si, it.key, { quantity: e.target.value })}
                                placeholder="0"
                              />
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={it.unit_price}
                                onChange={(e) => updateItem(si, it.key, { unit_price: e.target.value })}
                                placeholder="0"
                              />
                              <Input
                                value={it.notes}
                                onChange={(e) => updateItem(si, it.key, { notes: e.target.value })}
                                placeholder="備註"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="移除"
                                onClick={() => removeItem(si, it.key)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex flex-col gap-2 rounded-md border border-border/70 bg-muted/30 p-3">
                      <Label htmlFor={`vnote-${si}`} className="text-sm">
                        訂單備註
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          （會以紅字印在單子上）
                        </span>
                      </Label>
                      <Textarea
                        id={`vnote-${si}`}
                        rows={3}
                        className="bg-card"
                        value={sec.note}
                        onChange={(e) => updateSectionNote(si, e.target.value)}
                        placeholder="此廠商的訂單備註，例如：週五前送達 / 直送案場"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={addSection}>
                  <Plus className="size-4" /> 新增另一位廠商
                </Button>
                <p className="text-sm text-muted-foreground">
                  共 {sections.reduce((n, s) => n + s.rows.filter((r) => r.product_name.trim() !== "").length, 0)} 筆明細
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>從價格表帶入</DialogTitle>
          </DialogHeader>
          {prices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              此廠商尚無價格資料，可以先手動輸入，或到「價格表」頁面建立
            </p>
          ) : (
            <div className="flex flex-col">
              {prices.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPrice(p)}
                  className="flex items-center justify-between gap-4 rounded-lg border-b px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{p.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.spec, p.unit].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmtMoney(Number(p.unitPrice))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

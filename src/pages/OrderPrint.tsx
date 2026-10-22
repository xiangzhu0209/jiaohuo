import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bold, Edit, Eraser, ImageDown, Images, Printer, Type } from "lucide-react";
import {
  fetchOrder,
  fetchOrderItemsByOrder,
  setItemEmphasis,
  updateOrderStatus,
} from "@/lib/db";
import type { EmphasisField, EmphasisMark, OrderItem } from "@/lib/types";
import {
  collectEmphasisHits,
  downloadSheetPng,
  emphasisUpdates,
  type EmphasisHit,
} from "@/lib/order-utils";
import { useAuth } from "@/hooks/use-auth";
import OrderSheet from "@/components/order/order-sheet";
import OrderSheets from "@/components/order/order-sheets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

/** 螢幕上的字級縮放（只影響畫面預覽，列印固定 A4／A5 原尺寸）。 */
const ZOOM_KEY = "order-print-zoom-v1";
const ZOOM_OPTIONS = [
  { value: "0.85", label: "小（85%）" },
  { value: "1", label: "標準（100%）" },
  { value: "1.15", label: "大（115%）" },
  { value: "1.3", label: "特大（130%）" },
];

export default function OrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profileName } = useAuth();
  const [searchParams] = useSearchParams();
  const vendorParam = searchParams.get("vendor");
  const [paper, setPaper] = useState<"a4" | "a5l">("a4");
  const [exporting, setExporting] = useState<"single" | "batch" | null>(null);
  const sheetAreaRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(() => {
    try {
      return window.localStorage.getItem(ZOOM_KEY) ?? "1";
    } catch {
      return "1";
    }
  });

  const changeZoom = (v: string) => {
    setZoom(v);
    try {
      window.localStorage.setItem(ZOOM_KEY, v);
    } catch {
      /* 無法寫入時忽略 */
    }
  };

  const itemsKey = ["order-items", id];

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-print", id],
    enabled: !!id,
    queryFn: () => fetchOrder(id!),
  });

  const { data: items = [] } = useQuery({
    queryKey: itemsKey,
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

  const saveEmphasis = useMutation({
    // 一次可以同時改好幾筆明細（跨欄、跨列選取時）
    mutationFn: (updates: { itemId: string; emphasis: EmphasisMark[] }[]) =>
      Promise.all(updates.map((u) => setItemEmphasis(u.itemId, u.emphasis))).then(() => undefined),
    // 先更新畫面（馬上看到紅字／粗體），再寫回雲端
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: itemsKey });
      const previous = qc.getQueryData<OrderItem[]>(itemsKey);
      const changed = new Map(updates.map((u) => [u.itemId, u.emphasis]));
      qc.setQueryData<OrderItem[]>(itemsKey, (old) =>
        (old ?? []).map((it) =>
          changed.has(it.id) ? { ...it, emphasis: changed.get(it.id) ?? [] } : it,
        ),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(itemsKey, ctx.previous);
      toast(`重點字儲存失敗：${(err as Error).message}`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: itemsKey });
    },
  });

  /**
   * 找出選取範圍碰到「哪些格子」的「哪幾個字」。
   * 可以跨欄、跨列（整列一次標），只要格子有 data-field 就會被算進來。
   */
  const readSelection = (): EmphasisHit[] => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return [];
    const range = sel.getRangeAt(0);
    const root = sheetAreaRef.current;
    if (!root || !range.intersectsNode(root)) return [];
    return collectEmphasisHits(range, root);
  };

  /** 把選取到的文字加上（或取消）紅字／加粗，存檔後畫面立即更新。 */
  const markSelection = (attr: "red" | "bold" | "clear") => {
    const hits = readSelection();
    if (hits.length === 0) {
      toast("請先在單子上用滑鼠選取要強調的文字");
      return;
    }
    const marksOf = (itemId: string) => items.find((it) => it.id === itemId)?.emphasis ?? [];
    const updates = emphasisUpdates(hits, marksOf, attr);

    saveEmphasis.mutate(updates);
    window.getSelection()?.removeAllRanges();
    const label = attr === "clear" ? "已取消" : attr === "red" ? "已標成紅字" : "已標成粗體";
    toast(hits.length > 1 ? `${label}（${hits.length} 處）` : label);
  };

  /** 依廠商把明細分組（順序同單子上的排列），供「各廠商各一張圖」使用。 */
  const vendorSheets = useMemo(() => {
    const groups: { id: string; name: string; items: OrderItem[] }[] = [];
    for (const it of items) {
      const key = it.vendorId || it.vendorName || "其他";
      let group = groups.find((g) => g.id === key);
      if (!group) {
        group = { id: key, name: it.vendorName || "廠商", items: [] };
        groups.push(group);
      }
      group.items.push(it);
    }
    return groups;
  }, [items]);

  const fileNameBase = `叫貨單_${order?.orderNo ?? id ?? ""}`;
  const shownVendorName = vendorParam
    ? items.find((it) => it.vendorId === vendorParam)?.vendorName
    : undefined;

  /** 匯出目前畫面上這張紙為 PNG。 */
  const exportCurrentPng = async () => {
    const node = sheetAreaRef.current?.querySelector<HTMLElement>(".paper-sheet");
    if (!node) return;
    setExporting("single");
    try {
      const name = `${fileNameBase}${shownVendorName ? `_${shownVendorName}` : ""}.png`;
      await downloadSheetPng(node, name, { paper });
      toast(`已匯出圖片：${name}`);
    } catch (err) {
      toast(`匯出圖片失敗：${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  /** 一家廠商一張圖（只含該廠商的明細），方便分別傳給各廠商。 */
  const exportPerVendorPng = async () => {
    const nodes = [
      ...(batchRef.current?.querySelectorAll<HTMLElement>("[data-export-vendor] .paper-sheet") ??
        []),
    ];
    if (nodes.length === 0) return;
    setExporting("batch");
    try {
      for (const node of nodes) {
        const vendorName = node.closest("[data-export-vendor]")?.getAttribute("data-export-vendor");
        await downloadSheetPng(node, `${fileNameBase}_${vendorName || "廠商"}.png`, { paper });
        // 連續下載太快瀏覽器會擋，稍微等一下
        await new Promise((r) => setTimeout(r, 400));
      }
      toast(`已匯出 ${nodes.length} 張圖片（每個廠商一張）`);
    } catch (err) {
      toast(`匯出圖片失敗：${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar (hidden when printing) */}
      <div className="print-hidden flex flex-col gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/orders")}>
            <ArrowLeft className="size-4" /> 返回叫貨單
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/orders/${id}/edit`)}>
              <Edit className="size-4" /> 修改訂單
            </Button>
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
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">畫面字級</span>
              <Select value={zoom} onValueChange={changeZoom}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZOOM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {order && order.status !== "sent" && order.status !== "done" && (
              <Button variant="outline" onClick={() => markSent.mutate()} disabled={markSent.isPending}>
                {markSent.isPending ? "更新中…" : "標記為已送出"}
              </Button>
            )}
            <Button variant="outline" onClick={exportCurrentPng} disabled={exporting !== null || !order}>
              <ImageDown className="size-4" />
              {exporting === "single" ? "產生中…" : "匯出圖片"}
            </Button>
            {vendorSheets.length > 1 && !vendorParam && (
              <Button
                variant="outline"
                onClick={exportPerVendorPng}
                disabled={exporting !== null || !order}
              >
                <Images className="size-4" />
                {exporting === "batch" ? "產生中…" : "各廠商各一張"}
              </Button>
            )}
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> 列印 / 存成 PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
          <span className="text-sm text-muted-foreground">重點字：</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => markSelection("red")}
          >
            <Type className="size-3.5 text-destructive" /> 紅字
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => markSelection("bold")}
          >
            <Bold className="size-3.5" /> 加粗
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => markSelection("clear")}
          >
            <Eraser className="size-3.5" /> 清除
          </Button>
          <span className="text-xs text-muted-foreground">
            用滑鼠在單子上選取要強調的字（可以跨欄、整列一次選），再按上面的鈕（馬上存檔）
          </span>
        </div>
      </div>

      {isLoading || !order ? (
        <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>
      ) : (
        <>
          <div
            ref={sheetAreaRef}
            className="print:![zoom:1] print:![width:auto]"
            style={{ zoom: Number(zoom), width: `calc(100% / ${zoom})` }}
          >
            <OrderSheets order={order} items={items} singleVendor={vendorParam} paper={paper} />
          </div>

          {/*
            畫面外的紙張：一家廠商一張，只在按「各廠商各一張」時用來產生圖片。
            用 fixed 放到畫面外（不能 display:none，否則量不到版面）。
          */}
          {vendorSheets.length > 1 && (
            <div ref={batchRef} aria-hidden className="print-hidden pointer-events-none fixed top-0 -left-[20000px]">
              {vendorSheets.map((g) => (
                <div key={g.id} data-export-vendor={g.name}>
                  <OrderSheet
                    order={order}
                    items={g.items}
                    issuer={order.createdBy || profileName}
                    vendorName={g.name}
                    paper={paper}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

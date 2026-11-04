import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCheck, Edit, ImageDown, Printer } from "lucide-react";
import { fetchSalesOrdersByIds, markSalesOrdered } from "@/lib/sales-db";
import {
  VARIANT_LABELS,
  WINDOWS_PER_PAGE,
  chunkWindows,
  isAdminEmail,
  windowLabels,
  type PrintVariant,
} from "@/lib/sales-types";
import { downloadSheetPng, paperWidthPx } from "@/lib/order-utils";
import { useAuth } from "@/hooks/use-auth";
import SalesGuard from "@/components/order/sales-guard";
import SalesPage from "@/components/order/sales-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Paper = "a4" | "a5l";
const PAPER_KEY = "sales-print-paper-v1";

const readPaper = (): Paper => {
  try {
    return window.localStorage.getItem(PAPER_KEY) === "a5l" ? "a5l" : "a4";
  } catch {
    return "a4";
  }
};

function PrintInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profileName } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const [params, setParams] = useSearchParams();
  const ids = useMemo(
    () => (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [params],
  );
  const idsKey = ids.join(",");
  // 留存單（完整）或安裝單（不含牌價），由網址 type 決定，預設留存單
  const variant: PrintVariant = params.get("type") === "install" ? "install" : "keep";
  const changeVariant = (v: PrintVariant) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", v);
        return next;
      },
      { replace: true },
    );

  const [paper, setPaper] = useState<Paper>(readPaper);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fitRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);

  const changePaper = (v: Paper) => {
    setPaper(v);
    try {
      window.localStorage.setItem(PAPER_KEY, v);
    } catch {
      /* 無法寫入時忽略 */
    }
  };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-print", idsKey],
    enabled: ids.length > 0,
    queryFn: () => fetchSalesOrdersByIds(ids),
  });

  // 預覽依畫面寬度縮放，手機上也看得到整張紙（列印時一律還原成原尺寸）
  const paperWidth = paperWidthPx(paper);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / paperWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [paperWidth]);

  const pages = useMemo(
    () =>
      orders.flatMap((order) => {
        const per = WINDOWS_PER_PAGE[paper];
        const allLabels = windowLabels(order.windows);
        const chunks = chunkWindows(order.windows, per);
        return chunks.map((windows, i) => ({
          order,
          windows,
          pageNo: i + 1,
          pageCount: chunks.length,
          labels: allLabels.slice(i * per, i * per + windows.length),
        }));
      }),
    [orders, paper],
  );

  const pendingIds = orders.filter((o) => o.status === "submitted").map((o) => o.id);

  const markOrdered = useMutation({
    mutationFn: () => markSalesOrdered(pendingIds, profileName || user?.email || ""),
    onSuccess: () => {
      toast(`已標記 ${pendingIds.length} 張為已下單`);
      void qc.invalidateQueries({ queryKey: ["sales-inbox"] });
      void qc.invalidateQueries({ queryKey: ["sales-orders"] });
      void qc.invalidateQueries({ queryKey: ["sales-print"] });
    },
    onError: (err) => toast(`更新失敗：${(err as Error).message}`),
  });

  /** 每一頁輸出一張圖片（A4／A5 各自的版面比例，方便直接傳給別人）。 */
  const exportImages = async () => {
    const holders = [...(sheetsRef.current?.querySelectorAll<HTMLElement>("[data-export-name]") ?? [])];
    if (holders.length === 0) return;
    setExporting(true);
    try {
      for (const holder of holders) {
        const node = holder.querySelector<HTMLElement>(".paper-sheet");
        if (!node) continue;
        await downloadSheetPng(node, `${holder.dataset.exportName ?? "業務單"}.png`, { paper });
        // 連續下載太快瀏覽器會擋，稍微等一下
        await new Promise((r) => setTimeout(r, 400));
      }
      toast(`已匯出 ${holders.length} 張圖片`);
    } catch (err) {
      toast(`匯出圖片失敗：${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const fileName = (name: string, date: string, pageNo: number, pageCount: number) =>
    `${VARIANT_LABELS[variant]}_${name || "未填客戶"}_${date}${pageCount > 1 ? `_第${pageNo}頁` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="print-hidden flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> 返回
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">種類</span>
              <Select value={variant} onValueChange={(v) => changeVariant(v as PrintVariant)}>
                <SelectTrigger className="h-10 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">{VARIANT_LABELS.keep}</SelectItem>
                  <SelectItem value="install">{VARIANT_LABELS.install}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">紙張</span>
              <Select value={paper} onValueChange={(v) => changePaper(v as Paper)}>
                <SelectTrigger className="h-10 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 直式</SelectItem>
                  <SelectItem value="a5l">A5 橫式</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {orders.length === 1 && (
              <Button variant="outline" onClick={() => navigate(`/sales/${orders[0].id}/edit`)}>
                <Edit className="size-4" /> {orders[0].status === "ordered" && !isAdmin ? "查看" : "修改"}
              </Button>
            )}
            <Button variant="outline" disabled={exporting || pages.length === 0} onClick={() => void exportImages()}>
              <ImageDown className="size-4" />
              {exporting ? "產生中…" : pages.length > 1 ? `匯出圖片（${pages.length} 張）` : "匯出圖片"}
            </Button>
            <Button disabled={pages.length === 0} onClick={() => window.print()}>
              <Printer className="size-4" /> 列印／存成 PDF
            </Button>
          </div>
        </div>
        {isAdmin && pendingIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <span className="text-sm text-muted-foreground">
              印好之後，把這 {pendingIds.length} 張單標記為已下單，它們就會離開待下單區
            </span>
            <Button variant="outline" disabled={markOrdered.isPending} onClick={() => markOrdered.mutate()}>
              <CheckCheck className="size-4" /> {markOrdered.isPending ? "更新中…" : "標記為已下單"}
            </Button>
          </div>
        )}
      </div>

      {ids.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">沒有指定要預覽的單</p>
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">找不到這些單，或沒有權限查看</p>
      ) : (
        <div ref={fitRef} className="w-full">
          <div
            className="mx-auto print:![zoom:1] print:!w-full"
            style={{ zoom, width: paperWidth }}
          >
            <div ref={sheetsRef} className="flex flex-col gap-6">
              {pages.map((p) => (
                <div
                  key={`${p.order.id}-${p.pageNo}`}
                  className="print-sheet"
                  data-export-name={fileName(p.order.customerName, p.order.orderDate, p.pageNo, p.pageCount)}
                >
                  <SalesPage
                    order={p.order}
                    windows={p.windows}
                    labels={p.labels}
                    pageNo={p.pageNo}
                    pageCount={p.pageCount}
                    paper={paper}
                    variant={variant}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesPrint() {
  return (
    <SalesGuard>
      <PrintInner />
    </SalesGuard>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, DatabaseZap, FileJson, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { fetchAllOrderItems, fetchAllPrices, fetchOrders, fetchVendors } from "@/lib/db";
import {
  importSeedData,
  loadSeedFile,
  seedCounts,
  type SeedCounts,
  type SeedData,
} from "@/lib/seed-import";
import { toast } from "sonner";

const EMPTY: SeedCounts = { vendors: 0, prices: 0, orders: 0, items: 0 };

const SUM = (c: SeedCounts) => c.vendors + c.prices + c.orders + c.items;

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * 一次性工具：把打包時附上的舊資料（public/seed-data.json）匯入 Firebase。
 * 只需要做一次；之後這個頁面就可以不用管它。
 */
export default function Setup() {
  const qc = useQueryClient();
  const [seed, setSeed] = useState<SeedData | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: current = EMPTY, isFetching, error } = useQuery({
    queryKey: ["cloud-counts"],
    queryFn: async () => {
      const [vendors, prices, orders, items] = await Promise.all([
        fetchVendors(),
        fetchAllPrices(),
        fetchOrders(),
        fetchAllOrderItems(),
      ]);
      return {
        vendors: vendors.length,
        prices: prices.length,
        orders: orders.length,
        items: items.length,
      } satisfies SeedCounts;
    },
  });

  const hasExisting = SUM(current) > 0;

  const handleLoad = async () => {
    try {
      const loaded = await loadSeedFile();
      setSeed(loaded);
      setConfirmed(false);
      toast(`已讀取備份檔，共 ${SUM(seedCounts(loaded))} 筆資料`);
    } catch (error) {
      toast(`讀取失敗：${(error as Error).message}`, { duration: 6000 });
    }
  };

  const handleImport = async () => {
    if (!seed) return;
    setRunning(true);
    setProgress({ done: 0, total: SUM(seedCounts(seed)) });
    try {
      const imported = await importSeedData(seed, setProgress);
      await qc.invalidateQueries({ queryKey: ["cloud-counts"] });
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["prices"] });
      toast(
        `匯入完成：廠商 ${imported.vendors}、價格 ${imported.prices}、叫貨單 ${imported.orders}、明細 ${imported.items}`,
        { duration: 8000 },
      );
    } catch (error) {
      toast(`匯入失敗：${(error as Error).message}`, { duration: 8000 });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const canImport = !!seed && !running && (!hasExisting || confirmed);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">舊資料匯入</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            把搬家前在 Enter Cloud 上的資料複製到 Firebase（只需做一次）
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>讀不到雲端資料</AlertTitle>
          <AlertDescription>
            {(error as Error).message}
            <br />
            如果訊息跟權限有關，請確認已經把 firestore.rules 的內容貼到 Firebase
            的「Firestore Database → 規則」並按發布。
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseZap className="size-4 text-primary" />
              目前雲端資料
            </CardTitle>
            <CardDescription>已經存在 Firebase 裡的筆數</CardDescription>
          </CardHeader>
          <CardContent className={isFetching ? "opacity-60" : undefined}>
            <CountRow label="廠商" value={current.vendors} />
            <CountRow label="價格表" value={current.prices} />
            <CountRow label="叫貨單" value={current.orders} />
            <CountRow label="叫貨明細" value={current.items} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="size-4 text-primary" />
              備份檔內容
            </CardTitle>
            <CardDescription>打包時一起附上的 seed-data.json</CardDescription>
          </CardHeader>
          <CardContent>
            {seed ? (
              <>
                <CountRow label="廠商" value={seed.vendors.length} />
                <CountRow label="價格表" value={seed.prices.length} />
                <CountRow label="叫貨單" value={seed.orders.length} />
                <CountRow label="叫貨明細" value={seed.items.length} />
                <p className="mt-3 text-xs text-muted-foreground">
                  匯出時間：{seed.exportedAt?.slice(0, 19).replace("T", " ") ?? "未知"}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  按下面的按鈕讀取備份檔，確認筆數後再匯入。
                </p>
                <Button variant="outline" onClick={() => void handleLoad()} disabled={running}>
                  <FileJson className="size-4" /> 讀取備份檔
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasExisting && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle />
          <AlertTitle>雲端已經有資料了</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            匯入會用備份檔的內容覆蓋「編號相同」的資料（例如同一張叫貨單）。新下單的資料不會被刪掉，
            但為了安全，建議先確認雲端資料都已經不需要。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4 text-primary" />
            開始匯入
          </CardTitle>
          <CardDescription>
            匯入過程請不要關閉這個頁面，大約需要幾秒鐘。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasExisting && (
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="confirm-overwrite"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                disabled={running}
              />
              <Label
                htmlFor="confirm-overwrite"
                className="text-sm font-normal leading-snug text-muted-foreground"
              >
                我了解匯入會覆蓋編號相同的舊資料
              </Label>
            </div>
          )}

          {progress && (
            <div className="flex flex-col gap-2">
              <Progress value={percent} className="h-2" />
              <p className="text-xs text-muted-foreground tabular-nums">
                已寫入 {progress.done} / {progress.total} 筆
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleImport()} disabled={!canImport}>
              <Upload className="size-4" />
              {running ? "匯入中…" : hasExisting ? "重新匯入（覆蓋）" : "匯入舊資料"}
            </Button>
            {!seed && (
              <span className="text-xs text-muted-foreground">請先讀取備份檔</span>
            )}
          </div>

          {SUM(current) > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" />
              雲端已有資料，若筆數與備份檔一致就代表匯入完成，可以直接使用。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

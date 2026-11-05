import type { ReactNode } from "react";
import { fmtMoney } from "@/lib/order-utils";
import {
  KIND_LABELS,
  MULTIPLIER_PRODUCT,
  PANEL_LABELS,
  PAY_LABELS,
  SIDE_LABELS,
  UNIT_SHORT,
  VARIANT_LABELS,
  balanceOf,
  mountText,
  type PayMethod,
  type PrintVariant,
  type SizeUnit,
  type SalesOrder,
  type SalesWindow,
} from "@/lib/sales-types";
import { cn } from "@/lib/utils";

const money = (n: number): string => (n > 0 ? fmtMoney(n) : "—");

/** T 字尺寸圖：橫桿上方寫寬，直桿旁邊寫高（對應手寫單上的 T 字）。 */
function TFigure({
  width,
  height,
  widthUnit,
  heightUnit,
  compact,
}: {
  width: string;
  height: string;
  widthUnit: SizeUnit;
  heightUnit: SizeUnit;
  compact: boolean;
}) {
  const widthSymbol = UNIT_SHORT[widthUnit];
  const heightSymbol = UNIT_SHORT[heightUnit];
  return (
    <svg
      viewBox="0 0 150 112"
      role="img"
      aria-label="尺寸圖"
      className={cn("shrink-0 self-start text-foreground", compact ? "w-[29mm]" : "w-[37mm]")}
    >
      <line x1="8" y1="30" x2="112" y2="30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="30" x2="60" y2="104" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <text x="60" y="21" textAnchor="middle" fontSize="14" fill="currentColor">
        {width ? `寬 ${width}${widthSymbol}` : "寬"}
      </text>
      <text x="67" y="72" fontSize="14" fill="currentColor">
        {height ? `高 ${height}${heightSymbol}` : "高"}
      </text>
    </svg>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="break-words">
      <span className="text-muted-foreground">{label}：</span>
      {children}
    </p>
  );
}

function WindowCell({
  w,
  label,
  compact,
  variant,
}: {
  w: SalesWindow;
  label: string;
  compact: boolean;
  variant: PrintVariant;
}) {
  const open = [w.panel ? PANEL_LABELS[w.panel] : "", w.side ? SIDE_LABELS[w.side] : ""]
    .filter(Boolean)
    .join("　");
  // 編號長得像 3-1 就代表和別的窗位是同一窗
  const grouped = label.includes("-");
  const showPrice = variant === "keep";
  return (
    <div
      className={cn(
        "flex min-w-0 gap-1.5 [break-inside:avoid]",
        grouped ? "border-2 border-foreground" : "border",
        compact ? "min-h-[38mm] p-1.5" : "min-h-[51mm] p-2",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <p className="break-words font-semibold">
          <span className={cn("mr-1 font-normal", grouped ? "text-destructive" : "text-muted-foreground")}>
            {label}.
          </span>
          {w.product || "—"}
          {w.colorCode ? `：${w.colorCode}` : ""}
          {grouped && (
            <span className="ml-1.5 border border-destructive px-1 text-[0.8em] font-semibold text-destructive">
              同一窗 {label.split("-")[0]}
            </span>
          )}
        </p>
        <Line label="空間">{w.space || "—"}</Line>
        <Line label="開法">{open || "—"}</Line>
        <Line label="鎖點">{mountText(w) || "—"}</Line>
        {showPrice && (
          <Line label="牌價">
            {w.listPrice ? fmtMoney(Number(w.listPrice)) : "—"}
            {w.product === MULTIPLIER_PRODUCT && (
              <span className="ml-3">
                <span className="text-muted-foreground">倍數：</span>
                {w.multiplier || "—"}
              </span>
            )}
          </Line>
        )}
        <Line label="製作備註">{w.note || "—"}</Line>
        <Line label="安裝備註">{w.installNote || "—"}</Line>
      </div>
      <TFigure
        width={w.width}
        height={w.height}
        widthUnit={w.widthUnit}
        heightUnit={w.heightUnit}
        compact={compact}
      />
    </div>
  );
}

const cellBase = "min-w-0 border-l border-t px-1.5";
const labelCell = (compact: boolean) =>
  cn(cellBase, "whitespace-nowrap font-medium", compact ? "py-0.5" : "py-1");
const valueCell = (compact: boolean) => cn(cellBase, "break-words", compact ? "py-0.5" : "py-1");

const payText = (method: PayMethod) => (method ? PAY_LABELS[method] : "");

function OrderHeader({
  order,
  compact,
  variant,
}: {
  order: SalesOrder;
  compact: boolean;
  variant: PrintVariant;
}) {
  const balance = balanceOf(order.total, order.deposit);
  const L = labelCell(compact);
  const V = valueCell(compact);
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      <div className="flex flex-wrap items-end justify-between gap-x-4">
        <p>
          <span className="mr-3 border border-foreground px-1.5 font-semibold">{VARIANT_LABELS[variant]}</span>
          <span className="font-semibold">{KIND_LABELS[order.kind]}</span>
          <span className="ml-3">負責人：{order.person || "—"}</span>
        </p>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-0.5 text-right">
          <p>預計安裝時間：{order.installTime || "—"}</p>
          <p>排定安裝時間：{order.scheduledInstallTime || "—"}</p>
        </div>
      </div>

      <div className="flex items-stretch">
        <div className="grid min-w-0 flex-1 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto_auto] border-b border-r">
          <div className={L}>日期</div>
          <div className={cn(V, "whitespace-nowrap")}>{order.orderDate || "—"}</div>
          <div className={L}>客戶名</div>
          <div className={V}>{order.customerName || "—"}</div>
          <div className={L}>電話</div>
          <div className={cn(V, "whitespace-nowrap")}>{order.phone || "—"}</div>
          <div className={L}>地址</div>
          <div className={cn(V, "col-span-5")}>{order.address || "—"}</div>
        </div>
        <div className="grid w-[38%] shrink-0 grid-cols-[auto_minmax(0,1fr)] border-b border-r">
          <div className={L}>總價</div>
          <div className={cn(V, "text-right tabular-nums")}>{money(order.total)}</div>
          <div className={L}>訂金</div>
          <div className={cn(V, "flex justify-between gap-2 tabular-nums")}>
            <span>{money(order.deposit)}</span>
            <span>{payText(order.depositMethod)}</span>
          </div>
          <div className={L}>尾款</div>
          <div className={cn(V, "flex justify-between gap-2 tabular-nums")}>
            <span>{order.total > 0 ? fmtMoney(balance) : "—"}</span>
            <span>{payText(order.balanceMethod)}</span>
          </div>
        </div>
      </div>

      <p className="break-words">
        <span className="text-muted-foreground">訂單備註：</span>
        {order.notes || "—"}
      </p>
    </div>
  );
}

/**
 * 一頁業務單。A4 直式照手寫單的樣子（2 欄 × 4 排共 8 個窗位），
 * A5 橫式較緊湊（2 欄 × 2 排共 4 個窗位）。第一頁有完整單頭，續頁只留客戶名。
 */
export default function SalesPage({
  order,
  windows,
  labels,
  pageNo,
  pageCount,
  paper,
  variant,
}: {
  order: SalesOrder;
  windows: SalesWindow[];
  /** 這一頁每個窗位的編號（同窗會是 3-1、3-2） */
  labels: string[];
  pageNo: number;
  pageCount: number;
  paper: "a4" | "a5l";
  variant: PrintVariant;
}) {
  const compact = paper === "a5l";
  return (
    <div
      className={cn(
        "paper-sheet flex flex-col bg-card text-card-foreground",
        "rounded-lg border shadow-elegant print:rounded-none print:border-0 print:shadow-none",
        compact ? "sheet-a5-landscape gap-1.5 p-3 text-[13px]" : "gap-2 p-4 text-[15px] print:p-0",
      )}
    >
      {pageNo === 1 ? (
        <OrderHeader order={order} compact={compact} variant={variant} />
      ) : (
        <p className="flex justify-between border-b pb-1 font-medium">
          <span>
            <span className="mr-2 border border-foreground px-1 text-[0.85em]">{VARIANT_LABELS[variant]}</span>
            客戶名：{order.customerName || "—"}
            <span className="ml-3">日期：{order.orderDate || "—"}（續）</span>
          </span>
          <span className="ml-3">預計安裝：{order.installTime || "—"}</span>
          <span className="ml-3">排定安裝：{order.scheduledInstallTime || "—"}</span>
        </p>
      )}

      {windows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">尚未加入窗位</p>
      ) : (
        <div className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", compact ? "gap-1.5" : "gap-2")}>
          {windows.map((w, i) => (
            <WindowCell key={w.id} w={w} label={labels[i] ?? String(i + 1)} compact={compact} variant={variant} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <p className="text-right text-muted-foreground">
          第 {pageNo}／{pageCount} 頁
        </p>
      )}
    </div>
  );
}

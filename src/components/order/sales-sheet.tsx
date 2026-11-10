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
  WINDOW_SHAPE_LABELS,
  balanceOf,
  mountText,
  supportsLeadWeight,
  type PayMethod,
  type PrintVariant,
  type SizeUnit,
  type SalesOrder,
  type SalesWindow,
} from "@/lib/sales-types";
import { cn } from "@/lib/utils";
import { SalesText } from "@/components/order/sales-emphasis";

const money = (n: number): string => (n > 0 ? fmtMoney(n) : "");

/**
 * 尺寸草圖：橫桿（寬）＋中間直桿（高）。
 * L 型：橫桿一端多一隻短腳；八字型：橫桿兩端各一隻短腳。數字直接標在對應線段旁。
 */
function TFigure({ width, height, widthUnit, heightUnit, compact, win, order }: {
  width: string; height: string; widthUnit: SizeUnit; heightUnit: SizeUnit;
  compact: boolean; win: SalesWindow; order: SalesOrder;
}) {
  const widthSymbol = UNIT_SHORT[widthUnit];
  const heightSymbol = UNIT_SHORT[heightUnit];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />;
  const marks = order.printEmphasis;
  const widthText = (fontSize: number, x: number, y: number) => (
    <text x={x} y={y} textAnchor="middle" fontSize={fontSize} fill="currentColor">
      寬 {width && <SalesText svg text={`${width}${widthSymbol}`} field={`window:${win.id}:width`} marks={marks} />}
    </text>
  );
  const heightText = (fontSize: number, x: number, y: number) => (
    <text x={x} y={y} fontSize={fontSize} fill="currentColor">
      高 {height && <SalesText svg text={`${height}${heightSymbol}`} field={`window:${win.id}:height`} marks={marks} />}
    </text>
  );
  // 腳長：位置依窗型決定；沒填時顯示「腳」佔位
  const sideText = (index: number, x: number, y: number, anchor: "start" | "end") => (
    <text x={x} y={y} textAnchor={anchor} fontSize={14} fill="currentColor">
      {win.shapeLengths[index]
        ? <SalesText svg text={`${win.shapeLengths[index]}${widthSymbol}`} field={`window:${win.id}:shapeLength:${index}`} marks={marks} />
        : "腳"}
    </text>
  );
  return (
    <div className={cn("shrink-0 self-start text-foreground", compact ? "w-[36mm]" : "w-[45mm]")}>
      <svg viewBox="0 0 180 120" role="img" aria-label={WINDOW_SHAPE_LABELS[win.shape]} className="w-full overflow-visible">
        {win.shape === "t" && (
          <>
            {line(8, 42, 112, 42)}{line(60, 42, 60, 112)}
            {widthText(17, 60, 30)}
            {heightText(17, 68, 82)}
          </>
        )}
        {win.shape === "l-left" && (
          <>
            {line(44, 42, 150, 42)}{line(44, 42, 44, 82)}{line(104, 42, 104, 112)}
            {widthText(16, 97, 30)}
            {sideText(0, 38, 66, "end")}
            {heightText(16, 110, 82)}
          </>
        )}
        {win.shape === "l-right" && (
          <>
            {line(30, 42, 136, 42)}{line(136, 42, 136, 82)}{line(76, 42, 76, 112)}
            {widthText(16, 83, 30)}
            {sideText(0, 142, 66, "start")}
            {heightText(16, 82, 82)}
          </>
        )}
        {win.shape === "figure-eight" && (
          <>
            {line(40, 42, 140, 42)}{line(40, 42, 40, 82)}{line(140, 42, 140, 82)}{line(90, 42, 90, 112)}
            {widthText(16, 90, 30)}
            {sideText(0, 34, 66, "end")}
            {sideText(1, 146, 66, "start")}
            {heightText(16, 96, 96)}
          </>
        )}
      </svg>
    </div>
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
  order,
}: {
  order: SalesOrder;
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
  const measure = variant === "measure";
  // 丈量單：沒填的欄位印成底線，讓業務邊跟客人討論邊手寫
  const empty = measure ? <HandwriteBlank compact={compact} short /> : "—";
  const showPrice = variant !== "install";
  // 加鉛條只有布、紗才有；換成別的品項時就算舊資料還勾著也不印
  const showLead = w.leadWeight && supportsLeadWeight(w.product);
  const field = (name: string, text: string) => text
    ? <SalesText text={text} field={`window:${w.id}:${name}`} marks={order.printEmphasis} />
    : empty;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap gap-1.5 [break-inside:avoid]",
        grouped ? "border-2 border-foreground" : "border",
        compact ? "min-h-[38mm] p-1.5" : "min-h-[51mm] p-2",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <p className="break-words font-semibold">
          <span className={cn("mr-1 font-normal", grouped ? "text-destructive" : "text-muted-foreground")}>
            {label}.
          </span>
          {measure && !w.product && (
            <>
              <span className="font-normal text-muted-foreground">品項：</span>
              <HandwriteBlank compact={compact} short />
              <span className="ml-2 font-normal text-muted-foreground">色號：</span>
              <HandwriteBlank compact={compact} short />
            </>
          )}
          {w.product && field("product", w.product)}
          {(w.colorCode || w.fireProof || showLead) && (
            <>
              ：
              {w.fireProof ? (
                // 開防焰證明：色號整段紅字，後面自動加（防焰證明）
                <span className="text-destructive">
                  {w.colorCode && field("colorCode", w.colorCode)}
                  (防焰證明)
                </span>
              ) : (
                w.colorCode && field("colorCode", w.colorCode)
              )}
              {showLead && <span className="ml-1.5 text-destructive">加鉛條</span>}
            </>
          )}
        </p>
        {w.shape !== "t" && <Line label="窗型">{field("shape", WINDOW_SHAPE_LABELS[w.shape])}</Line>}
        <Line label="空間">
          {field("space", w.space)}
          {grouped && (
            <span className="ml-1.5 border border-destructive px-1 text-[0.8em] font-semibold text-destructive">
              {field("sameWindow", `同一窗 ${label.split("-")[0]}`)}
            </span>
          )}
        </Line>
        <Line label="開法">{field("open", open)}</Line>
        <Line label="鎖點">{field("mount", mountText(w))}</Line>
        {showPrice && (
          <Line label="牌價">
            {field("listPrice", w.listPrice ? fmtMoney(Number(w.listPrice)) : "")}
            {w.product === MULTIPLIER_PRODUCT && (
              <span className="ml-3">
                <span className="text-muted-foreground">倍數：</span>
                {field("multiplier", w.multiplier)}
              </span>
            )}
          </Line>
        )}
        <Line label="製作備註">{field("note", w.note)}</Line>
        <Line label="安裝備註">{field("installNote", w.installNote)}</Line>
      </div>
      <TFigure
        width={w.width}
        height={w.height}
        widthUnit={w.widthUnit}
        heightUnit={w.heightUnit}
        compact={compact}
        win={w}
        order={order}
      />
    </div>
  );
}

const cellBase = "min-w-0 border-l border-t px-1.5";
const labelCell = (compact: boolean) =>
  cn(cellBase, "whitespace-nowrap font-medium", compact ? "py-0.5" : "py-1");
const valueCell = (compact: boolean) => cn(cellBase, "break-words", compact ? "py-0.5" : "py-1");

const payText = (method: PayMethod) => (method ? PAY_LABELS[method] : "");

/** 沒填的欄位留一段底線空白，方便之後用手寫。 */
function HandwriteBlank({ compact, short = false }: { compact: boolean; short?: boolean }) {
  const width = short ? (compact ? "w-[16mm]" : "w-[22mm]") : compact ? "w-[34mm]" : "w-[44mm]";
  return (
    <span aria-hidden="true" className={cn("inline-block border-b border-foreground align-bottom", width)}>
      &nbsp;
    </span>
  );
}

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
  const measure = variant === "measure";
  // 丈量單：沒填的欄位印成底線，之後手寫
  const field = (name: string, text: string) => text
    ? <SalesText text={text} field={`header:${name}`} marks={order.printEmphasis} />
    : measure ? <HandwriteBlank compact={compact} short /> : "—";
  const L = labelCell(compact);
  const V = valueCell(compact);
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      <div className="flex flex-wrap items-end justify-between gap-x-4">
        <p>
          <span className="mr-3 border border-foreground px-1.5 font-semibold">{VARIANT_LABELS[variant]}</span>
          <span className="font-semibold">{field("kind", KIND_LABELS[order.kind])}</span>
          <span className="ml-3">負責人：{field("person", order.person)}</span>
        </p>
        <div className="flex flex-wrap justify-start gap-x-4 gap-y-0.5">
          <p>預計安裝時間：{field("installTime", order.installTime)}</p>
          <p>
            排定安裝時間：
            {order.scheduledInstallTime ? (
              field("scheduledInstallTime", order.scheduledInstallTime)
            ) : (
              <HandwriteBlank compact={compact} />
            )}
          </p>
        </div>
      </div>

      <div className="flex items-stretch">
        <div className="grid min-w-0 flex-1 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto_auto] border-b border-r">
          <div className={L}>日期</div>
          <div className={cn(V, "whitespace-nowrap")}>{field("orderDate", order.orderDate)}</div>
          <div className={L}>客戶名</div>
          <div className={V}>{field("customerName", order.customerName)}</div>
          <div className={L}>電話</div>
          <div className={cn(V, "whitespace-nowrap")}>{field("phone", order.phone)}</div>
          <div className={L}>地址</div>
          <div className={cn(V, "col-span-5")}>{field("address", order.address)}</div>
        </div>
        <div className="grid w-[38%] shrink-0 grid-cols-[auto_minmax(0,1fr)] border-b border-r">
          <div className={L}>總價</div>
          <div className={cn(V, "text-left tabular-nums")}>{field("total", money(order.total))}</div>
          <div className={L}>訂金</div>
          <div className={cn(V, "flex justify-start gap-2 tabular-nums")}>
            <span>{field("deposit", money(order.deposit))}</span>
            <span>{order.depositMethod ? field("depositMethod", payText(order.depositMethod)) : ""}</span>
          </div>
          <div className={L}>尾款</div>
          <div className={cn(V, "flex justify-start gap-2 tabular-nums")}>
            <span>{field("balance", order.total > 0 ? fmtMoney(balance) : "")}</span>
            <span>{order.balanceMethod ? field("balanceMethod", payText(order.balanceMethod)) : ""}</span>
          </div>
        </div>
      </div>

      <div className="min-h-8 break-words border border-foreground/60 px-2 py-1">
        <span className="font-medium">訂單備註：</span>
        {field("notes", order.notes)}
      </div>
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
      data-sales-order={order.id}
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
          <span className="ml-3">
            排定安裝：{order.scheduledInstallTime || <HandwriteBlank compact={compact} />}
          </span>
        </p>
      )}

      {windows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">尚未加入窗位</p>
      ) : (
        <div className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", compact ? "gap-1.5" : "gap-2")}>
          {windows.map((w, i) => (
            <WindowCell key={w.id} order={order} w={w} label={labels[i] ?? String(i + 1)} compact={compact} variant={variant} />
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

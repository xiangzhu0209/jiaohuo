import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MOUNT_LABELS,
  MULTIPLIER_PRODUCT,
  PANEL_LABELS,
  ROOM_SUGGESTIONS,
  SALES_PRODUCTS,
  SIDE_LABELS,
  UNIT_LABELS,
  digitsOnly,
  windowSummary,
  type SalesWindow,
} from "@/lib/sales-types";
import { cn } from "@/lib/utils";

/** 單選按鈕組：再按一次選中的項目就取消選取。 */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T | "") => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange((v as T | "") ?? "")}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-11 flex-1 text-base data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const entries = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** 手機優先的單一窗位表單卡片。 */
export default function WindowCard({
  index,
  label,
  total,
  win,
  open,
  disabled,
  onToggle,
  onChange,
  onDuplicate,
  onMove,
  onRemove,
}: {
  index: number;
  /** 顯示用編號（同窗會是 3-1、3-2） */
  label: string;
  total: number;
  win: SalesWindow;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<SalesWindow>) => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const summary = windowSummary(win);
  const inputClass = "h-11 text-base";

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-elegant">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-muted/40 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 bg-primary text-sm font-semibold text-primary-foreground">
          {label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{summary || "新的窗位"}</span>
          {!open && win.sameAsPrev && index > 1 && (
            <span className="block truncate text-xs text-primary">與上一個同窗</span>
          )}
          {!open && win.mount && (
            <span className="block truncate text-xs text-muted-foreground">
              {MOUNT_LABELS[win.mount]}
              {win.panel ? `・${PANEL_LABELS[win.panel]}` : ""}
              {win.side ? `・${SIDE_LABELS[win.side]}` : ""}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 p-4">
          <Field label="空間">
            <div className="flex flex-wrap gap-1.5">
              {ROOM_SUGGESTIONS.map((room) => (
                <button
                  key={room}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ space: win.space === room ? "" : room })}
                  className={cn(
                    "h-11 min-w-16 flex-1 rounded-md border px-3 text-base transition-colors",
                    win.space === room
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {room}
                </button>
              ))}
            </div>
            <Input
              className={inputClass}
              value={ROOM_SUGGESTIONS.includes(win.space) ? "" : win.space}
              disabled={disabled}
              onChange={(e) => onChange({ space: e.target.value })}
              placeholder="其他空間，自己輸入"
            />
            {index > 1 && (
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-2.5 text-sm">
                <Checkbox className="size-5" checked={win.sameAsPrev} disabled={disabled}
                  onCheckedChange={(v) => onChange({ sameAsPrev: v === true })} />
                與上一個窗位是同一窗（例如同一扇窗的布＋紗）
              </label>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="品項">
              <Select
                value={win.product}
                disabled={disabled}
                onValueChange={(v) =>
                  onChange(v === MULTIPLIER_PRODUCT ? { product: v } : { product: v, multiplier: "" })
                }
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="選擇品項" />
                </SelectTrigger>
                <SelectContent>
                  {SALES_PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="色號">
              <Input
                className={inputClass}
                value={win.colorCode}
                disabled={disabled}
                onChange={(e) => onChange({ colorCode: e.target.value })}
                placeholder="色號"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="寬">
              <Input
                className={inputClass}
                inputMode="decimal"
                value={win.width}
                disabled={disabled}
                onChange={(e) => onChange({ width: digitsOnly(e.target.value) })}
                placeholder="寬"
              />
              <Choice
                value={win.widthUnit}
                options={entries(UNIT_LABELS)}
                disabled={disabled}
                onChange={(widthUnit) => onChange({ widthUnit: widthUnit || "cm" })}
              />
            </Field>
            <Field label="高">
              <Input
                className={inputClass}
                inputMode="decimal"
                value={win.height}
                disabled={disabled}
                onChange={(e) => onChange({ height: digitsOnly(e.target.value) })}
                placeholder="高"
              />
              <Choice
                value={win.heightUnit}
                options={entries(UNIT_LABELS)}
                disabled={disabled}
                onChange={(heightUnit) => onChange({ heightUnit: heightUnit || "cm" })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="牌價">
              <Input
                className={inputClass}
                inputMode="decimal"
                value={win.listPrice}
                disabled={disabled}
                onChange={(e) => onChange({ listPrice: digitsOnly(e.target.value) })}
                placeholder="牌價"
              />
            </Field>
            {win.product === MULTIPLIER_PRODUCT && (
              <Field label="倍數">
                <Input
                  className={inputClass}
                  inputMode="decimal"
                  value={win.multiplier}
                  disabled={disabled}
                  onChange={(e) => onChange({ multiplier: digitsOnly(e.target.value) })}
                  placeholder="倍數"
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="單／雙">
              <Choice
                value={win.panel}
                options={entries(PANEL_LABELS)}
                disabled={disabled}
                onChange={(panel) => onChange({ panel })}
              />
            </Field>
            <Field label="左／右">
              <Choice
                value={win.side}
                options={entries(SIDE_LABELS)}
                disabled={disabled}
                onChange={(side) => onChange({ side })}
              />
            </Field>
          </div>

          <Field label="鎖點">
            <Choice
              value={win.mount}
              options={entries(MOUNT_LABELS)}
              disabled={disabled}
              onChange={(mount) =>
                onChange(
                  mount === "wall"
                    ? { mount }
                    : { mount, wallOption: "", shiftChi: "" },
                )
              }
            />
            {win.mount === "wall" && (
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <Choice
                  value={win.wallOption}
                  options={[
                    { value: "shift", label: "上移" },
                    { value: "frame", label: "鎖框" },
                  ]}
                  disabled={disabled}
                  onChange={(wallOption) =>
                    onChange(wallOption === "shift" ? { wallOption } : { wallOption, shiftChi: "" })
                  }
                />
                {win.wallOption === "shift" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">上移</span>
                    <Input
                      className="h-11 w-28 text-base"
                      inputMode="decimal"
                      value={win.shiftChi}
                      disabled={disabled}
                      onChange={(e) => onChange({ shiftChi: digitsOnly(e.target.value) })}
                      placeholder="幾"
                    />
                    <span className="text-sm text-muted-foreground">尺</span>
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="製作備註">
            <Textarea
              rows={2}
              className="text-base"
              value={win.note}
              disabled={disabled}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="給製作端看的備註"
            />
          </Field>

          <Field label="安裝備註">
            <Textarea
              rows={2}
              className="text-base"
              value={win.installNote}
              disabled={disabled}
              onChange={(e) => onChange({ installNote: e.target.value })}
              placeholder="給安裝師傅看的備註"
            />
          </Field>

          {!disabled && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" disabled={index === 1} onClick={() => onMove(-1)}>
                <ArrowUp className="size-4" /> 上移
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={index === total} onClick={() => onMove(1)}>
                <ArrowDown className="size-4" /> 下移
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
                <Copy className="size-4" /> 複製
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="size-4" /> 刪除
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

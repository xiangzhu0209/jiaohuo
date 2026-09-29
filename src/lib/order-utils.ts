export const toNum = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

export const ORDER_STATUSES = ["draft", "sent", "done"] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已送出",
  done: "已完成",
};

export const statusLabel = (s: string): string => STATUS_LABELS[s] ?? s;

/**
 * Generates the next order number: JA-YYYYMMDD-XXX (per-day sequence).
 */
export function generateOrderNo(existingNos: string[], date: Date): string {
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `JA-${ymd}-`;
  let max = 0;
  for (const no of existingNos) {
    if (no.startsWith(prefix)) {
      const n = parseInt(no.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** "2026-09" -> [startOfMonthISO, endOfMonthISO] */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = new Date(y, m, 0).getDate();
  return { start, end: `${y}-${String(m).padStart(2, "0")}-${end}` };
}

export const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

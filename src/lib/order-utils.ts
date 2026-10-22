import type { EmphasisField, EmphasisMark } from "./types";

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

/* ============================================================
   紙張上的重點字：把選取範圍換算成「哪一筆的哪個欄位、第幾個字到第幾個字」
   ============================================================ */

export interface EmphasisHit {
  itemId: string;
  field: EmphasisField;
  start: number;
  end: number;
}

/**
 * 找出選取範圍碰到哪些可標記的格子（可以跨欄、跨列），
 * 並把選取的起點／終點換算成該格的字元範圍（超出格子就貼齊頭尾）。
 */
export function collectEmphasisHits(range: Range, root: HTMLElement): EmphasisHit[] {
  const hits: EmphasisHit[] = [];
  const cells = [...root.querySelectorAll<HTMLElement>("[data-field][data-item-id]")];
  for (const cell of cells) {
    if (!range.intersectsNode(cell)) continue;
    const field = cell.dataset.field as EmphasisField | undefined;
    const itemId = cell.dataset.itemId;
    if (!field || !itemId) continue;
    const length = (cell.textContent ?? "").length;
    if (length === 0) continue;
    const offsetOf = (node: Node, offset: number) => {
      const before = range.cloneRange();
      before.selectNodeContents(cell);
      before.setEnd(node, offset);
      return Math.min(length, Math.max(0, before.toString().length));
    };
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    if (end > start) hits.push({ itemId, field, start, end });
  }
  return hits;
}

/**
 * 把「同一個欄位的幾個字元範圍」加上／取消某種效果，回傳新的記號陣列。
 * 純函式：同一筆明細的多個欄位要依序套用，最後才寫回一次（避免互相覆蓋）。
 */
export function applyEmphasis(
  marks: EmphasisMark[],
  field: EmphasisField,
  ranges: { start: number; end: number }[],
  attr: "red" | "bold" | "clear",
): EmphasisMark[] {
  const overlaps = (r: { start: number; end: number }) => (m: EmphasisMark) =>
    m.field === field && m.end > r.start && m.start < r.end;

  if (attr === "clear") {
    return marks.filter((m) => !ranges.some((r) => overlaps(r)(m)));
  }

  // 選到的每一段都已經有這個效果 → 當作「取消」
  const covered = ranges.every((r) =>
    marks.some(
      (m) => m.field === field && m[attr] === true && m.start <= r.start && m.end >= r.end,
    ),
  );
  if (covered) {
    return marks.filter(
      (m) => m.field !== field || m[attr] !== true || !ranges.some((r) => overlaps(r)(m)),
    );
  }

  return [
    ...marks,
    ...ranges.map((r) =>
      attr === "red"
        ? ({ field, start: r.start, end: r.end, red: true } as EmphasisMark)
        : ({ field, start: r.start, end: r.end, bold: true } as EmphasisMark),
    ),
  ];
}

/**
 * 依選取結果算出「每一筆明細的新記號」。
 * 同一筆明細只會產生「一筆更新」——跨欄選取時若逐欄各寫一次，
 * 同一筆會被寫好幾次、後面的把前面的覆蓋掉（畫面就只變一格）。
 */
export function emphasisUpdates(
  hits: EmphasisHit[],
  currentMarks: (itemId: string) => EmphasisMark[],
  attr: "red" | "bold" | "clear",
): { itemId: string; emphasis: EmphasisMark[] }[] {
  const perItem = new Map<string, Map<EmphasisField, { start: number; end: number }[]>>();
  for (const hit of hits) {
    let fields = perItem.get(hit.itemId);
    if (!fields) {
      fields = new Map();
      perItem.set(hit.itemId, fields);
    }
    const ranges = fields.get(hit.field) ?? [];
    ranges.push({ start: hit.start, end: hit.end });
    fields.set(hit.field, ranges);
  }

  const updates: { itemId: string; emphasis: EmphasisMark[] }[] = [];
  for (const [itemId, fields] of perItem) {
    let marks = currentMarks(itemId);
    for (const [field, ranges] of fields) {
      marks = applyEmphasis(marks, field, ranges, attr);
    }
    updates.push({ itemId, emphasis: marks });
  }
  return updates;
}

/* ============================================================
   檔案輸出：CSV（月對帳）與 PNG 圖片（叫貨單）
   ============================================================ */

export type CsvCell = string | number | null | undefined;
export type CsvRow = CsvCell[];

/** 檔名不能有 \ / : * ? " < > | 這些字元，一律換成底線。 */
export const safeFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, "_").trim();

const escapeCsvCell = (value: CsvCell): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: CsvRow[]): string =>
  rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");

/**
 * 下載一份 CSV。開頭加 UTF-8 BOM、換行用 \r\n，
 * 直接用 Excel／Numbers／Google 試算表開啟都不會亂碼。
 */
export const downloadCsv = (fileName: string, rows: CsvRow[]): void => {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, fileName);
};

/** 下載一份檔案（CSV 與圖片共用）。 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/*
 * 把叫貨單（畫面上的紙張）匯出成一張 PNG，不需要任何外部套件。
 *
 * 步驟：
 * 1. 複製一份紙張，放到畫面外的固定寬度容器重新排版（寬度＝列印時的紙張內容
 *    寬度，所以圖看起來就跟列印出來一樣，字不會被拉小）。
 * 2. 把算好的樣式寫成 inline style —— 產生圖片時讀不到網頁的 CSS，只能靠 inline。
 * 3. 內嵌用得到的字型子集（中文字型檔很大，只抓這張單用到的字）。
 * 4. 塞進 SVG 的 foreignObject，交給瀏覽器自己算圖，再畫到 canvas 轉成 PNG。
 */

const PX_PER_MM = 96 / 25.4;

/** 紙張可列印範圍的寬度（px）：A4 直式扣 8mm 邊界、A5 橫式扣 6mm。 */
export const paperWidthPx = (paper: "a4" | "a5l"): number =>
  Math.round((paper === "a5l" ? 210 - 12 : 210 - 16) * PX_PER_MM);

export interface PngOptions {
  paper: "a4" | "a5l";
  /** 幾倍解析度（2 ＝ 兩倍，字比較利） */
  scale?: number;
  /** 圖片四周留白 */
  margin?: number;
}

/** 這些樣式不需要（或不可以）寫進圖片裡。 */
const SKIP_PROPS = new Set([
  "animation",
  "animation-delay",
  "animation-direction",
  "animation-duration",
  "animation-fill-mode",
  "animation-iteration-count",
  "animation-name",
  "animation-play-state",
  "animation-timing-function",
  "transition",
  "transition-delay",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "cursor",
  "pointer-events",
  "content",
  "zoom",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "inset-block",
  "inset-inline",
  "z-index",
  "float",
  "clear",
  "transform",
  "transform-origin",
  "perspective",
  "will-change",
  "contain",
  "content-visibility",
  "container",
  "container-type",
  "backdrop-filter",
  "mix-blend-mode",
  "isolation",
  "appearance",
  "resize",
  "user-select",
  "-webkit-print-color-adjust",
  "print-color-adjust",
  "outline",
  "outline-color",
  "outline-style",
  "outline-width",
  "outline-offset",
  "clip",
  "clip-path",
  "mask",
]);

/** 把元素（含子孫）目前算出來的樣式全部寫成 inline style。 */
function inlineStyles(root: HTMLElement): void {
  const nodes: HTMLElement[] = [root, ...root.querySelectorAll<HTMLElement>("*")];
  const snapshot = nodes.map((el) => {
    const cs = getComputedStyle(el);
    const decls: [string, string][] = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      if (SKIP_PROPS.has(prop)) continue;
      const value = cs.getPropertyValue(prop);
      if (!value) continue;
      // 列印時字重會由 Light(300) 提到 400，圖片比照，字才不會太細
      decls.push([prop, prop === "font-weight" && value === "300" ? "400" : value]);
    }
    return { el, decls };
  });
  for (const { el, decls } of snapshot) {
    for (const [prop, value] of decls) el.style.setProperty(prop, value);
  }
}

/* ---------- 字型內嵌：只抓這張單用得到的字型子集 ---------- */

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+HK:wght@200..900&display=swap";

const fontFileCache = new Map<string, string>();
let fontCssCache: string | null = null;

const inUnicodeRange = (code: number, ranges: string): boolean =>
  ranges.split(",").some((part) => {
    const text = part.trim().replace(/^u\+/i, "");
    if (!text) return false;
    const [from, to] = text.split("-");
    const lo = parseInt(from, 16);
    const hi = to ? parseInt(to, 16) : lo;
    return Number.isFinite(lo) && code >= lo && code <= (Number.isFinite(hi) ? hi : lo);
  });

const toDataUri = async (url: string): Promise<string> => {
  const cached = fontFileCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`字型檔讀取失敗（${res.status}）`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const uri = `data:font/woff2;base64,${btoa(binary)}`;
  fontFileCache.set(url, uri);
  return uri;
};

/** 依文字內容挑出用得到的字型子集，內嵌成 data URI 的 @font-face 規則。 */
async function buildFontCss(text: string): Promise<string> {
  if (!fontCssCache) {
    const res = await fetch(FONT_CSS_URL);
    if (!res.ok) throw new Error(`字型設定讀取失敗（${res.status}）`);
    fontCssCache = await res.text();
  }
  const codes = [...new Set([...text].map((c) => c.codePointAt(0) ?? 0))];
  const blocks = fontCssCache
    .split("@font-face")
    .slice(1)
    .map((block) => `@font-face${block.slice(0, block.indexOf("}") + 1)}`);
  const rules: string[] = [];
  for (const block of blocks) {
    const range = /unicode-range\s*:\s*([^;}]+)/i.exec(block)?.[1]?.trim() ?? "";
    const url = /url\(([^)]+)\)/.exec(block)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
    if (!url) continue;
    if (range && !codes.some((code) => inUnicodeRange(code, range))) continue;
    const uri = await toDataUri(url);
    rules.push(block.replace(/src\s*:[^;}]+/i, `src:url(${uri}) format('woff2')`));
  }
  return rules.join("\n");
}

/* ---------- 主要流程 ---------- */

/** 把一個紙張元素畫成 PNG。 */
export async function sheetToPng(node: HTMLElement, options: PngOptions): Promise<Blob> {
  const { paper, scale = 2, margin = 24 } = options;
  const width = paperWidthPx(paper);
  const background = "#ffffff";

  // 1) 複製到畫面外重新排版
  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.style.position = "fixed";
  stage.style.left = "-20000px";
  stage.style.top = "0";
  stage.style.width = `${width}px`;
  stage.style.background = background;
  const clone = node.cloneNode(true) as HTMLElement;
  stage.appendChild(clone);
  document.body.appendChild(stage);

  try {
    // 2) 版面調整成列印時的樣子：固定紙張內容寬度、去掉圓角／邊框／陰影
    clone.style.width = `${width}px`;
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.border = "none";
    clone.style.borderRadius = "0";
    clone.style.boxShadow = "none";
    if (paper === "a5l") clone.style.padding = "0";

    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const rect = clone.getBoundingClientRect();
    const w = Math.max(1, Math.ceil(rect.width));
    const h = Math.max(1, Math.ceil(rect.height));

    inlineStyles(clone);

    let fontCss = "";
    try {
      fontCss = await buildFontCss(clone.textContent ?? "");
    } catch (err) {
      console.warn("字型內嵌失敗，改用系統字型", err);
    }

    const xml = new XMLSerializer().serializeToString(clone);
    const totalW = w + margin * 2;
    const totalH = h + margin * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}"` +
      ` viewBox="0 0 ${totalW} ${totalH}">` +
      `<foreignObject x="0" y="0" width="${totalW}" height="${totalH}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${totalW}px;height:${totalH}px;` +
      `background:${background};padding:${margin}px;box-sizing:border-box;">` +
      (fontCss ? `<style>${fontCss}</style>` : "") +
      xml +
      `</div></foreignObject></svg>`;

    // 用 data: URI 而不是 blob: —— Chrome 把 blob: 的 SVG 視為跨來源，
    // 畫到 canvas 後會變成「污染的畫布」而無法匯出（實測 blob: 一定失敗）。
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("圖片產生失敗"));
      image.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(totalW * scale);
    canvas.height = Math.round(totalH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("這個瀏覽器不支援圖片匯出");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("圖片產生失敗");
    return blob;
  } finally {
    stage.remove();
  }
}

/** 把紙張匯出成 PNG 並下載。 */
export async function downloadSheetPng(
  node: HTMLElement,
  fileName: string,
  options: PngOptions,
): Promise<void> {
  const blob = await sheetToPng(node, options);
  downloadBlob(blob, fileName);
}

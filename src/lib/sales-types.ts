/**
 * 業務下單：資料型別、固定選項與小工具。
 *
 * 一張業務單 ＝ 一份文件（單頭資料＋所有窗位），窗位放在同一份文件裡，
 * 這樣讀寫都只要一次，也不需要額外的資料表。
 */

export type SalesKind = "company" | "sales";
export type SalesStatus = "draft" | "submitted" | "ordered";
export type PayMethod = "" | "cash" | "transfer";
export type PanelType = "" | "single" | "double";
export type SideType = "" | "left" | "right";
export type MountType = "" | "ceiling" | "wall" | "direct";
export type WallOption = "" | "shift" | "frame";
export type SizeUnit = "cm" | "tai";
export type WindowShape = "t" | "l-left" | "l-right" | "figure-eight";
export const WINDOW_SHAPE_LABELS: Record<WindowShape, string> = {
  t: "T型",
  "l-left": "L型（左）",
  "l-right": "L型（右）",
  "figure-eight": "八字型",
};

/** L 型多一個轉角邊，八字型左右各一個；寬、高仍是原本兩個尺寸。 */
export const SHAPE_SIDE_LABELS: Record<WindowShape, string[]> = {
  t: [],
  "l-left": ["左側轉角邊長"],
  "l-right": ["右側轉角邊長"],
  "figure-eight": ["左側邊長", "右側邊長"],
};
export type PrintVariant = "keep" | "install";
export type SalesMemberStatus = "pending" | "active" | "disabled";

/** 業務帳號的管理狀態。 */
export interface SalesMember {
  uid: string;
  email: string;
  name: string;
  status: SalesMemberStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
}

/** 一個窗位（手寫單上的一格）。 */
export interface SalesWindow {
  id: string;
  /** 空間，例如客廳、主臥（手寫單的「安裝位置」） */
  space: string;
  /** 品項：固定選項或自填內容 */
  product: string;
  productCustom: boolean;
  colorCode: string;
  /** 窗型與各段邊長（L 型兩段，八角窗八段） */
  shape: WindowShape;
  shapeLengths: string[];
  /** 寬度與高度各自的尺寸單位；舊單會由共用 unit 欄位回填 */
  widthUnit: SizeUnit;
  heightUnit: SizeUnit;
  /** 尺寸：保留使用者輸入的原樣 */
  width: string;
  height: string;
  /** 牌價（只有留存單會印出來） */
  listPrice: string;
  /** 倍數（只有品項是布才需要） */
  multiplier: string;
  /** 與上一個窗位是同一窗（例如同一扇窗的布＋紗） */
  sameAsPrev: boolean;
  panel: PanelType;
  side: SideType;
  /** 鎖點：天架／壁架／直上鎖 */
  mount: MountType;
  /** 壁架才有：上移幾尺，或鎖框 */
  wallOption: WallOption;
  shiftChi: string;
  installNote: string;
  /** 製作備註（給製作端看的備註） */
  note: string;
}

export interface SalesPrintMark {
  field: string;
  text: string;
  start: number;
  end: number;
  red?: boolean;
  bold?: boolean;
}

export type SalesEditRequestStatus = "" | "pending" | "approved" | "rejected";

export interface SalesOrder {
  id: string;
  ownerId: string;
  /** 負責人（預設帶登入者姓名，可修改） */
  person: string;
  kind: SalesKind;
  orderDate: string;
  installTime: string;
  scheduledInstallTime: string;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  deposit: number;
  depositMethod: PayMethod;
  balanceMethod: PayMethod;
  notes: string;
  status: SalesStatus;
  /** 業務要求修改送出後訂單的狀態與原因 */
  editRequestStatus: SalesEditRequestStatus;
  editRequestReason: string;
  editRequestAt: string;
  editReviewedAt: string;
  editReviewedBy: string;
  /** 管理者核准後維持開放，直到管理者重新鎖定 */
  editApproved: boolean;
  printEmphasis: SalesPrintMark[];
  windows: SalesWindow[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  orderedAt: string;
  orderedBy: string;
}

/** 新增／儲存時寫入的欄位（id 與時間戳記由系統處理）。 */
export type SalesOrderInput = Omit<
  SalesOrder,
  "id" | "createdAt" | "updatedAt" | "submittedAt" | "orderedAt" | "orderedBy" | "printEmphasis"
>;

/* ---------- 固定選項 ---------- */

/**
 * 品項清單：業務只能從這裡選。要增減品項，改這一個陣列即可。
 */
export const SALES_PRODUCTS: string[] = [
  "布",
  "紗",
  "捲簾",
  "調光",
  "木百",
  "風琴",
  "穿透簾",
  "拉門",
];

/** 只有這個品項才需要填倍數。 */
export const MULTIPLIER_PRODUCT = "布";
export const CUSTOM_PRODUCT_VALUE = "__custom_product__";

export const UNIT_LABELS: Record<SizeUnit, string> = { cm: "公分", tai: "台尺" };
/** 列印在尺寸圖上的簡寫 */
export const UNIT_SHORT: Record<SizeUnit, string> = { cm: "cm", tai: "尺" };

export const VARIANT_LABELS: Record<PrintVariant, string> = {
  keep: "留存單",
  install: "安裝單",
};

/** 空間選項（按鈕）；其他的空間在輸入框自己打字。 */
export const ROOM_SUGGESTIONS: string[] = ["客廳", "主臥", "次臥", "浴室", "書房"];

/**
 * 管理者（收單者）的登入信箱：只有他們看得到「待下單區」與所有人的單。
 * 注意：Firebase 的安全規則裡也有一份同樣的清單，兩邊要一致。
 */
export const ADMIN_EMAILS: string[] = ["h0968638819@gmail.com", "as20009277@gmail.com"];

export const isAdminEmail = (email: string | null | undefined): boolean =>
  !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.trim().toLowerCase());

export const KIND_LABELS: Record<SalesKind, string> = {
  company: "公司件",
  sales: "業務件",
};

export const STATUS_LABELS: Record<SalesStatus, string> = {
  draft: "草稿",
  submitted: "待下單",
  ordered: "已下單",
};

export const PAY_LABELS: Record<Exclude<PayMethod, "">, string> = {
  cash: "現",
  transfer: "轉",
};

export const PANEL_LABELS: Record<Exclude<PanelType, "">, string> = {
  single: "單開",
  double: "雙開",
};

export const SIDE_LABELS: Record<Exclude<SideType, "">, string> = {
  left: "左",
  right: "右",
};

export const MOUNT_LABELS: Record<Exclude<MountType, "">, string> = {
  ceiling: "天架",
  wall: "壁架",
  direct: "直上鎖",
};

/* ---------- 建立空資料 ---------- */

export const newWindowId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `w-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const newWindow = (): SalesWindow => ({
  id: newWindowId(),
  space: "",
  product: "",
  productCustom: false,
  colorCode: "",
  shape: "t",
  shapeLengths: [],
  widthUnit: "cm",
  heightUnit: "cm",
  width: "",
  height: "",
  listPrice: "",
  multiplier: "",
  sameAsPrev: false,
  panel: "",
  side: "",
  mount: "",
  wallOption: "",
  shiftChi: "",
  installNote: "",
  note: "",
});

/** 完全沒填任何東西的窗位（儲存時略過、送出檢查時不算）。 */
export const isBlankWindow = (w: SalesWindow): boolean =>
  !(
    w.space ||
    w.product ||
    w.shapeLengths.some((length) => length) ||
    w.colorCode ||
    w.width ||
    w.height ||
    w.shape !== "t" ||
    w.listPrice ||
    w.panel ||
    w.side ||
    w.mount ||
    w.installNote ||
    w.note
  );

/** 一律用本地日期（避免 UTC 換日造成差一天）。 */
export const todayISO = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

/* ---------- 計算與顯示 ---------- */

export const balanceOf = (total: number, deposit: number): number => total - deposit;

/** 鎖點的文字說明：壁架會附上「上移 N 尺」或「鎖框」。 */
export const mountText = (w: SalesWindow): string => {
  if (!w.mount) return "";
  const base = MOUNT_LABELS[w.mount];
  if (w.mount !== "wall") return base;
  if (w.wallOption === "frame") return `${base}・鎖框`;
  if (w.wallOption === "shift") {
    return w.shiftChi.trim() ? `${base}・上移 ${w.shiftChi.trim()} 尺` : `${base}・上移`;
  }
  return base;
};

/** 窗位摘要（折疊起來時顯示）。 */
export const windowSummary = (w: SalesWindow): string =>
  [
    w.space,
    [w.product, w.colorCode].filter(Boolean).join(" "),
    w.shape !== "t" ? WINDOW_SHAPE_LABELS[w.shape] : "",
    w.width || w.height
      ? `${w.width || "?"}${UNIT_SHORT[w.widthUnit]}×${w.height || "?"}${UNIT_SHORT[w.heightUnit]}`
      : "",
  ]
    .filter(Boolean)
    .join("・");

/**
 * 窗位編號：沒有「同窗」的就是 1、2、3…；
 * 勾了「與上一個同窗」的會跟上一個共用號碼，變成 3-1、3-2。
 */
export function windowLabels(windows: SalesWindow[]): string[] {
  const groups: number[][] = [];
  windows.forEach((w, i) => {
    if (i > 0 && w.sameAsPrev) groups[groups.length - 1].push(i);
    else groups.push([i]);
  });
  const labels: string[] = new Array<string>(windows.length).fill("");
  groups.forEach((g, gi) =>
    g.forEach((wi, k) => {
      labels[wi] = g.length > 1 ? `${gi + 1}-${k + 1}` : String(gi + 1);
    }),
  );
  return labels;
}

/** 一頁放幾個窗位：A4 直式照手寫單（2 欄 × 4 排），A5 橫式較緊湊。 */
export const WINDOWS_PER_PAGE: Record<"a4" | "a5l", number> = {
  a4: 8,
  a5l: 4,
};

export function chunkWindows<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** 只留下數字與小數點（手機輸入尺寸、金額用）。 */
export const digitsOnly = (value: string): string => value.replace(/[^\d.]/g, "");

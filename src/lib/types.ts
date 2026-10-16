export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface PriceItem {
  id: string;
  vendorId: string;
  productName: string;
  spec: string;
  unit: string;
  unitPrice: number;
  notes: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  projectName: string;
  status: string;
  notes: string;
  /** 出單人姓名（建立時紀錄，不隨使用者改名而變） */
  createdBy: string;
  /** 各廠商的訂單備註：vendorId -> 備註 */
  vendorNotes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Order item. Order-level fields (orderNo / orderDate / customerName /
 * vendorName) are denormalized onto each item so lists, printing and
 * reconciliation never need joins.
 */
export interface OrderItem {
  id: string;
  orderId: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  vendorId: string | null;
  vendorName: string;
  productName: string;
  size: string;
  /** 用量 */
  usage: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  /**
   * 明細在這張單子裡的顯示順序（0 起算）。舊資料沒有這個欄位，會沿用讀取
   * 順序（舊單的文件編號本身帶有 i001、i002… 的原始順序）。
   */
  sortOrder?: number;
  /** 月對帳用：這一筆是否已跟廠商結清（已算進帳單）。未設定＝未結清。 */
  settled?: boolean;
  createdAt: string;
}

/** Client-side editable line item for the order form (numeric fields as text). */
export interface OrderItemDraft {
  key: string;
  product_name: string;
  size: string;
  usage: string;
  spec: string;
  quantity: string;
  unit_price: string;
  notes: string;
}

/** 建立訂單時要寫入的欄位。 */
export interface NewOrderPayload {
  orderNo: string;
  orderDate: string;
  customerName: string;
  projectName: string;
  status: string;
  notes: string;
  vendorNotes: Record<string, string>;
  createdBy: string;
}

/** 訂單編輯時要寫入的明細列。 */
export interface ItemInsert {
  orderId: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  vendorId: string | null;
  vendorName: string;
  productName: string;
  size: string;
  usage: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  /** 顯示順序，由表單送出時的排列決定（舊資料可能沒有）。 */
  sortOrder?: number;
}

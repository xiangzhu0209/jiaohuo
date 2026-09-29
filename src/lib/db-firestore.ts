import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ItemInsert,
  NewOrderPayload,
  Order,
  OrderItem,
  PriceItem,
  Vendor,
} from "./types";
import { generateOrderNo } from "./order-utils";

export type { ItemInsert, NewOrderPayload };

/**
 * Firebase（Firestore）資料層：所有畫面都透過這裡讀寫，介面與原本完全相同。
 *
 * 集合：vendors / price_list / orders / order_items
 * 文件欄位一律用 camelCase，跟 UI 的型別一致，不再需要 snake_case 對應。
 */

const COL = {
  vendors: "vendors",
  prices: "price_list",
  orders: "orders",
  items: "order_items",
} as const;

/** 一次寫入的文件數上限（Firestore 單一批次為 500，取安全值）。 */
const BATCH_LIMIT = 400;

// ---- 型別轉換（雲端資料可能缺欄位，一律給安全預設值） ----

const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapVendor = (id: string, d: DocumentData): Vendor => ({
  id,
  name: str(d.name),
  phone: str(d.phone),
  notes: str(d.notes),
  createdAt: str(d.createdAt),
});

const mapPrice = (id: string, d: DocumentData): PriceItem => ({
  id,
  vendorId: str(d.vendorId),
  productName: str(d.productName),
  spec: str(d.spec),
  unit: str(d.unit),
  unitPrice: num(d.unitPrice),
  notes: str(d.notes),
  createdAt: str(d.createdAt),
});

const mapOrder = (id: string, d: DocumentData): Order => ({
  id,
  orderNo: str(d.orderNo),
  orderDate: str(d.orderDate),
  customerName: str(d.customerName),
  projectName: str(d.projectName),
  status: str(d.status) || "draft",
  notes: str(d.notes),
  createdBy: str(d.createdBy),
  vendorNotes: (d.vendorNotes ?? {}) as Record<string, string>,
  createdAt: str(d.createdAt),
  updatedAt: str(d.updatedAt),
});

const mapItem = (id: string, d: DocumentData): OrderItem => ({
  id,
  orderId: str(d.orderId),
  orderNo: str(d.orderNo),
  orderDate: str(d.orderDate),
  customerName: str(d.customerName),
  vendorId: d.vendorId === null || d.vendorId === undefined ? null : str(d.vendorId),
  vendorName: str(d.vendorName),
  productName: str(d.productName),
  size: str(d.size),
  usage: str(d.usage),
  spec: str(d.spec),
  quantity: num(d.quantity),
  unitPrice: num(d.unitPrice),
  notes: str(d.notes),
  createdAt: str(d.createdAt),
});

/** 依序把多個寫入動作分成安全大小的批次送出。 */
async function commitChunked(actions: ((batch: WriteBatch) => void)[]): Promise<void> {
  for (let i = 0; i < actions.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const action of actions.slice(i, i + BATCH_LIMIT)) action(batch);
    await batch.commit();
  }
}

// ---- 查詢 ----

export async function fetchVendors(): Promise<Vendor[]> {
  const snap = await getDocs(query(collection(db, COL.vendors), orderBy("name")));
  return snap.docs.map((d) => mapVendor(d.id, d.data()));
}

export async function fetchPrices(vendorId: string): Promise<PriceItem[]> {
  // 不用 orderBy：避免複合索引，排序改在前端做（資料量小）。
  const snap = await getDocs(query(collection(db, COL.prices), where("vendorId", "==", vendorId)));
  return snap.docs
    .map((d) => mapPrice(d.id, d.data()))
    .sort((a, b) => a.productName.localeCompare(b.productName, "zh-Hant"));
}

/** 讀取全部價格表（供色號自動帶價使用）。 */
export async function fetchAllPrices(): Promise<PriceItem[]> {
  const snap = await getDocs(collection(db, COL.prices));
  return snap.docs.map((d) => mapPrice(d.id, d.data()));
}

export async function fetchOrders(): Promise<Order[]> {
  const snap = await getDocs(query(collection(db, COL.orders), orderBy("orderDate", "desc")));
  return snap.docs.map((d) => mapOrder(d.id, d.data()));
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, COL.orders, id));
  return snap.exists() ? mapOrder(snap.id, snap.data()) : null;
}

export async function fetchOrderItemsByOrder(orderId: string): Promise<OrderItem[]> {
  const snap = await getDocs(query(collection(db, COL.items), where("orderId", "==", orderId)));
  return snap.docs
    .map((d) => mapItem(d.id, d.data()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function fetchOrderItemsByOrderIds(orderIds: string[]): Promise<OrderItem[]> {
  const out: OrderItem[] = [];
  for (let i = 0; i < orderIds.length; i += 10) {
    const chunk = orderIds.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, COL.items), where("orderId", "in", chunk)));
    out.push(...snap.docs.map((d) => mapItem(d.id, d.data())));
  }
  return out;
}

export async function fetchAllOrderItems(): Promise<OrderItem[]> {
  const snap = await getDocs(collection(db, COL.items));
  return snap.docs.map((d) => mapItem(d.id, d.data()));
}

// ---- 寫入 ----

export async function createOrder(payload: NewOrderPayload): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COL.orders), {
    orderNo: payload.orderNo,
    orderDate: payload.orderDate,
    customerName: payload.customerName,
    projectName: payload.projectName,
    status: payload.status,
    notes: payload.notes,
    vendorNotes: payload.vendorNotes,
    createdBy: payload.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateOrder(
  id: string,
  payload: Omit<NewOrderPayload, "createdBy" | "orderNo">,
): Promise<void> {
  await updateDoc(doc(db, COL.orders, id), {
    orderDate: payload.orderDate,
    customerName: payload.customerName,
    projectName: payload.projectName,
    status: payload.status,
    notes: payload.notes,
    vendorNotes: payload.vendorNotes,
    updatedAt: new Date().toISOString(),
  });
}

/** 刪除舊明細並重新插入（訂單編輯用）。order_items 已 denormalize 單據欄位。 */
export async function replaceOrderItems(orderId: string, items: ItemInsert[]): Promise<void> {
  const existing = await getDocs(query(collection(db, COL.items), where("orderId", "==", orderId)));
  const now = new Date().toISOString();

  const actions: ((batch: WriteBatch) => void)[] = [
    ...existing.docs.map((d) => (batch: WriteBatch) => batch.delete(d.ref)),
    ...items.map((it) => (batch: WriteBatch) =>
      batch.set(doc(collection(db, COL.items)), {
        orderId: it.orderId,
        orderNo: it.orderNo ?? "",
        orderDate: it.orderDate ?? "",
        customerName: it.customerName ?? "",
        vendorId: it.vendorId,
        vendorName: it.vendorName ?? "",
        productName: it.productName,
        size: it.size ?? "",
        usage: it.usage ?? "",
        spec: it.spec ?? "",
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        notes: it.notes ?? "",
        createdAt: now,
      }),
    ),
  ];
  await commitChunked(actions);
}

/** 刪除訂單（Firestore 沒有串聯刪除，明細要一起刪）。 */
export async function deleteOrder(id: string): Promise<void> {
  const items = await getDocs(query(collection(db, COL.items), where("orderId", "==", id)));
  await commitChunked([
    ...items.docs.map((d) => (batch: WriteBatch) => batch.delete(d.ref)),
    (batch: WriteBatch) => batch.delete(doc(db, COL.orders, id)),
  ]);
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  await updateDoc(doc(db, COL.orders, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/** 依當日既有單號產生下一張單號 JA-YYYYMMDD-XXX。 */
export async function nextOrderNo(orderDate: string): Promise<string> {
  const ymd = orderDate.split("-").join("");
  const prefix = `JA-${ymd}-`;
  const snap = await getDocs(
    query(
      collection(db, COL.orders),
      where("orderNo", ">=", prefix),
      where("orderNo", "<=", `${prefix}\uf8ff`),
    ),
  );
  const existing = snap.docs.map((d) => str(d.data().orderNo));
  return generateOrderNo(existing, new Date(`${orderDate}T00:00:00`));
}

/** 每次叫貨後把有單價的明細自動記錄進價格表（vendorId + 色號小寫比對）。 */
export async function upsertPrices(items: ItemInsert[]): Promise<void> {
  const byVendor = new Map<string, ItemInsert[]>();
  for (const it of items) {
    if (!it.vendorId || !(it.unitPrice > 0)) continue;
    const list = byVendor.get(it.vendorId) ?? [];
    list.push(it);
    byVendor.set(it.vendorId, list);
  }

  const actions: ((batch: WriteBatch) => void)[] = [];
  const now = new Date().toISOString();

  for (const [vendorId, entries] of byVendor) {
    const snap = await getDocs(query(collection(db, COL.prices), where("vendorId", "==", vendorId)));
    const byLower = new Map<
      string,
      { ref: DocumentReference; spec: string; unitPrice: number }
    >();
    for (const d of snap.docs) {
      const data = d.data();
      byLower.set(str(data.productName).toLowerCase(), {
        ref: d.ref,
        spec: str(data.spec),
        unitPrice: num(data.unitPrice),
      });
    }

    for (const e of entries) {
      const key = e.productName.toLowerCase();
      const existing = byLower.get(key);
      if (existing) {
        existing.unitPrice = e.unitPrice;
        existing.spec = e.spec || existing.spec;
        const { ref } = existing;
        const next = { unitPrice: existing.unitPrice, spec: existing.spec };
        actions.push((batch: WriteBatch) => batch.update(ref, next));
      } else {
        const ref = doc(collection(db, COL.prices));
        const record = {
          vendorId,
          productName: e.productName,
          spec: e.spec ?? "",
          unit: "",
          unitPrice: e.unitPrice,
          notes: "",
          createdAt: now,
        };
        actions.push((batch: WriteBatch) => batch.set(ref, record));
        byLower.set(key, { ref, spec: record.spec, unitPrice: record.unitPrice });
      }
    }
  }

  await commitChunked(actions);
}

// ---- 廠商／價格 CRUD（頁面直接使用） ----

export async function createVendor(name: string, phone: string, notes: string): Promise<void> {
  await addDoc(collection(db, COL.vendors), {
    name,
    phone,
    notes,
    createdAt: new Date().toISOString(),
  });
}

export async function updateVendor(
  id: string,
  name: string,
  phone: string,
  notes: string,
): Promise<void> {
  await updateDoc(doc(db, COL.vendors, id), { name, phone, notes });
}

export async function deleteVendor(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.vendors, id));
}

export async function createPrice(
  vendorId: string,
  payload: { productName: string; spec: string; unit: string; unitPrice: number; notes: string },
): Promise<void> {
  await addDoc(collection(db, COL.prices), {
    vendorId,
    productName: payload.productName,
    spec: payload.spec,
    unit: payload.unit,
    unitPrice: payload.unitPrice,
    notes: payload.notes,
    createdAt: new Date().toISOString(),
  });
}

export async function updatePrice(
  id: string,
  payload: { productName: string; spec: string; unit: string; unitPrice: number; notes: string },
): Promise<void> {
  await updateDoc(doc(db, COL.prices, id), {
    productName: payload.productName,
    spec: payload.spec,
    unit: payload.unit,
    unitPrice: payload.unitPrice,
    notes: payload.notes,
  });
}

export async function deletePrice(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.prices, id));
}

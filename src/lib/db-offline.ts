import { generateOrderNo } from "./order-utils";
import type { Order, OrderItem, PriceItem, Vendor } from "./types";
import type { ItemInsert, NewOrderPayload } from "./types";

/**
 * 離線備案資料層：連不上後端時，改用這台電腦瀏覽器的 localStorage 暫存
 * 資料，介面與 db.ts 完全一致，所以所有頁面都不用改。
 *
 * 重要：
 * - 資料只存在「這個瀏覽器 + 這個網址」，換瀏覽器／換網址／清瀏覽資料就看不到。
 * - 之後請用「匯出資料」把 JSON 交出來，再匯入雲端。
 */

const STORE_KEY = "order-offline-store-v1";
const MODE_KEY = "order-offline-mode-v1";
const USER_KEY = "order-offline-user-v1";

export interface OfflineStore {
  vendors: Vendor[];
  prices: PriceItem[];
  orders: Order[];
  items: OrderItem[];
}

const emptyStore = (): OfflineStore => ({ vendors: [], prices: [], orders: [], items: [] });

// ---- 模式與使用者 ----

export function isOfflineMode(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOfflineMode(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(MODE_KEY, "1");
    else window.localStorage.removeItem(MODE_KEY);
  } catch {
    /* 無法寫入時忽略 */
  }
}

export function getOfflineUser(): string {
  try {
    return window.localStorage.getItem(USER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setOfflineUser(name: string): void {
  try {
    window.localStorage.setItem(USER_KEY, name);
  } catch {
    /* ignore */
  }
}

// ---- 存取 ----

function read(): OfflineStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<OfflineStore>;
    return {
      vendors: parsed.vendors ?? [],
      prices: parsed.prices ?? [],
      orders: parsed.orders ?? [],
      items: parsed.items ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function write(store: OfflineStore): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* 空間不足等情況忽略 */
  }
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---- 查詢 ----

export async function fetchVendors(): Promise<Vendor[]> {
  return [...read().vendors].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchPrices(vendorId: string): Promise<PriceItem[]> {
  return read()
    .prices.filter((p) => p.vendorId === vendorId)
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function fetchAllPrices(): Promise<PriceItem[]> {
  return read().prices;
}

export async function fetchOrders(): Promise<Order[]> {
  return [...read().orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
}

export async function fetchOrder(id: string): Promise<Order | null> {
  return read().orders.find((o) => o.id === id) ?? null;
}

export async function fetchOrderItemsByOrder(orderId: string): Promise<OrderItem[]> {
  return read().items.filter((i) => i.orderId === orderId);
}

export async function fetchOrderItemsByOrderIds(orderIds: string[]): Promise<OrderItem[]> {
  const wanted = new Set(orderIds);
  return read().items.filter((i) => wanted.has(i.orderId));
}

export async function fetchAllOrderItems(): Promise<OrderItem[]> {
  return read().items;
}

// ---- 訂單寫入 ----

export async function createOrder(payload: NewOrderPayload): Promise<string> {
  const store = read();
  const now = new Date().toISOString();
  const order: Order = {
    id: uid(),
    orderNo: payload.orderNo,
    orderDate: payload.orderDate,
    customerName: payload.customerName,
    projectName: payload.projectName,
    status: payload.status,
    notes: payload.notes,
    createdBy: payload.createdBy,
    vendorNotes: payload.vendorNotes ?? {},
    createdAt: now,
    updatedAt: now,
  };
  store.orders.push(order);
  write(store);
  return order.id;
}

export async function updateOrder(
  id: string,
  payload: Omit<NewOrderPayload, "createdBy" | "orderNo">,
): Promise<void> {
  const store = read();
  const order = store.orders.find((o) => o.id === id);
  if (!order) return;
  order.orderDate = payload.orderDate;
  order.customerName = payload.customerName;
  order.projectName = payload.projectName;
  order.status = payload.status;
  order.notes = payload.notes;
  order.vendorNotes = payload.vendorNotes ?? {};
  order.updatedAt = new Date().toISOString();
  write(store);
}

export async function replaceOrderItems(orderId: string, items: ItemInsert[]): Promise<void> {
  const store = read();
  store.items = store.items.filter((i) => i.orderId !== orderId);
  const now = new Date().toISOString();
  for (const it of items) {
    store.items.push({
      id: uid(),
      orderId: it.orderId,
      orderNo: it.orderNo,
      orderDate: it.orderDate,
      customerName: it.customerName,
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
    });
  }
  write(store);
}

export async function deleteOrder(id: string): Promise<void> {
  const store = read();
  store.orders = store.orders.filter((o) => o.id !== id);
  store.items = store.items.filter((i) => i.orderId !== id);
  write(store);
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const store = read();
  const order = store.orders.find((o) => o.id === id);
  if (!order) return;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  write(store);
}

export async function nextOrderNo(orderDate: string): Promise<string> {
  const ymd = orderDate.split("-").join("");
  const prefix = `JA-${ymd}-`;
  const existing = read()
    .orders.map((o) => o.orderNo)
    .filter((no) => no.startsWith(prefix));
  return generateOrderNo(existing, new Date(`${orderDate}T00:00:00`));
}

export async function upsertPrices(items: ItemInsert[]): Promise<void> {
  const store = read();
  for (const it of items) {
    if (!it.vendorId || !(it.unitPrice > 0)) continue;
    const existing = store.prices.find(
      (p) =>
        p.vendorId === it.vendorId &&
        p.productName.toLowerCase() === it.productName.toLowerCase(),
    );
    if (existing) {
      existing.unitPrice = it.unitPrice;
      if (it.spec) existing.spec = it.spec;
    } else {
      store.prices.push({
        id: uid(),
        vendorId: it.vendorId,
        productName: it.productName,
        spec: it.spec ?? "",
        unit: "",
        unitPrice: it.unitPrice,
        notes: "",
        createdAt: new Date().toISOString(),
      });
    }
  }
  write(store);
}

// ---- 廠商 / 價格 CRUD ----

export async function createVendor(name: string, phone: string, notes: string): Promise<void> {
  const store = read();
  store.vendors.push({
    id: uid(),
    name,
    phone,
    notes,
    createdAt: new Date().toISOString(),
  });
  write(store);
}

export async function updateVendor(
  id: string,
  name: string,
  phone: string,
  notes: string,
): Promise<void> {
  const store = read();
  const vendor = store.vendors.find((v) => v.id === id);
  if (!vendor) return;
  vendor.name = name;
  vendor.phone = phone;
  vendor.notes = notes;
  // 明細上的廠商名稱是 denormalize 的，改名後一起更新（雲端也是靠 vendor_id 對應）
  for (const it of store.items) {
    if (it.vendorId === id) it.vendorName = name;
  }
  write(store);
}

export async function deleteVendor(id: string): Promise<void> {
  const store = read();
  store.vendors = store.vendors.filter((v) => v.id !== id);
  store.prices = store.prices.filter((p) => p.vendorId !== id);
  // 雲端是 on delete set null：明細保留、只把 vendor_id 清掉
  for (const it of store.items) {
    if (it.vendorId === id) it.vendorId = null;
  }
  write(store);
}

export async function createPrice(
  vendorId: string,
  payload: { productName: string; spec: string; unit: string; unitPrice: number; notes: string },
): Promise<void> {
  const store = read();
  store.prices.push({
    id: uid(),
    vendorId,
    productName: payload.productName,
    spec: payload.spec,
    unit: payload.unit,
    unitPrice: payload.unitPrice,
    notes: payload.notes,
    createdAt: new Date().toISOString(),
  });
  write(store);
}

export async function updatePrice(
  id: string,
  payload: { productName: string; spec: string; unit: string; unitPrice: number; notes: string },
): Promise<void> {
  const store = read();
  const price = store.prices.find((p) => p.id === id);
  if (!price) return;
  price.productName = payload.productName;
  price.spec = payload.spec;
  price.unit = payload.unit;
  price.unitPrice = payload.unitPrice;
  price.notes = payload.notes;
  write(store);
}

export async function deletePrice(id: string): Promise<void> {
  const store = read();
  store.prices = store.prices.filter((p) => p.id !== id);
  write(store);
}

// ---- 匯出（交給雲端匯入用） ----

export interface OfflineExport {
  exportedAt: string;
  offlineUser: string;
  vendors: Vendor[];
  prices: PriceItem[];
  orders: Order[];
  items: OrderItem[];
}

export function buildOfflineExport(): OfflineExport {
  const store = read();
  return {
    exportedAt: new Date().toISOString(),
    offlineUser: getOfflineUser(),
    ...store,
  };
}

export function offlineCounts(): { vendors: number; orders: number; items: number } {
  const store = read();
  return { vendors: store.vendors.length, orders: store.orders.length, items: store.items.length };
}

/** 下載離線資料 JSON（今天的叫貨單）。 */
export function downloadOfflineExport(): { orders: number; items: number } {
  const data = buildOfflineExport();
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, "");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jiaohuo-offline-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { orders: data.orders.length, items: data.items.length };
}

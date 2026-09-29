import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * 一次性「舊資料匯入」：把打包時附帶的 public/seed-data.json 寫進 Firestore。
 * 因為文件編號沿用原本的編號，重複匯入只會覆蓋同一份資料，不會產生重複。
 */

export interface SeedVendor {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface SeedPrice {
  id: string;
  vendorId: string;
  productName: string;
  spec: string;
  unit: string;
  unitPrice: number;
  notes: string;
  createdAt: string;
}

export interface SeedOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  projectName: string;
  status: string;
  notes: string;
  createdBy: string;
  vendorNotes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SeedItem {
  id: string;
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
  createdAt: string;
}

export interface SeedData {
  version: number;
  exportedAt: string;
  vendors: SeedVendor[];
  prices: SeedPrice[];
  orders: SeedOrder[];
  items: SeedItem[];
}

export interface SeedCounts {
  vendors: number;
  prices: number;
  orders: number;
  items: number;
}

export interface SeedProgress {
  done: number;
  total: number;
}

const BATCH_LIMIT = 400;

const COLLECTIONS = {
  vendors: "vendors",
  prices: "price_list",
  orders: "orders",
  items: "order_items",
} as const;

interface Row {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

export function seedCounts(seed: SeedData): SeedCounts {
  return {
    vendors: seed.vendors?.length ?? 0,
    prices: seed.prices?.length ?? 0,
    orders: seed.orders?.length ?? 0,
    items: seed.items?.length ?? 0,
  };
}

/** 讀取與這個網站放在一起的備份檔。 */
export async function loadSeedFile(): Promise<SeedData> {
  const url = new URL("seed-data.json", document.baseURI).toString();
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`讀不到備份檔 seed-data.json（${response.status}）`);
  }
  const parsed = (await response.json()) as SeedData;
  if (!parsed || !Array.isArray(parsed.vendors)) {
    throw new Error("備份檔格式不正確");
  }
  return parsed;
}

function collect(rows: Row[], collection: string, list: readonly { id?: string }[] | undefined) {
  for (const raw of list ?? []) {
    const { id, ...data } = raw as { id?: string } & Record<string, unknown>;
    if (id) rows.push({ collection, id, data });
  }
}

export async function importSeedData(
  seed: SeedData,
  onProgress?: (progress: SeedProgress) => void,
): Promise<SeedCounts> {
  const rows: Row[] = [];
  collect(rows, COLLECTIONS.vendors, seed.vendors);
  collect(rows, COLLECTIONS.prices, seed.prices);
  collect(rows, COLLECTIONS.orders, seed.orders);
  collect(rows, COLLECTIONS.items, seed.items);

  const total = rows.length;
  let done = 0;
  onProgress?.({ done, total });

  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, row.collection, row.id), row.data);
    }
    await batch.commit();
    done += Math.min(BATCH_LIMIT, rows.length - i);
    onProgress?.({ done, total });
  }

  return seedCounts(seed);
}

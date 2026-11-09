import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  newWindowId,
  type PayMethod,
  type SalesOrder,
  type SalesEditRequestStatus,
  type SalesOrderInput,
  type SalesStatus,
  type SalesWindow,
  type SalesPrintMark,
} from "./sales-types";

/** 業務單（一張單一份文件，窗位放在裡面）。 */
const COLLECTION = "sales_orders";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const PAY: readonly PayMethod[] = ["", "cash", "transfer"];
const STATUSES: readonly SalesStatus[] = ["draft", "submitted", "ordered"];
const EDIT_REQUEST_STATUSES: readonly SalesEditRequestStatus[] = ["", "pending", "approved", "rejected"];

function mapWindow(raw: unknown): SalesWindow {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(d.id) || newWindowId(),
    space: str(d.space),
    product: str(d.product),
    productCustom: d.productCustom === true,
    colorCode: str(d.colorCode),
    shape: pick(d.shape, ["t", "l-left", "l-right", "figure-eight"] as const, "t"),
    shapeLengths: Array.isArray(d.shapeLengths) ? d.shapeLengths.map(str).slice(0, 8) : [],
    widthUnit: pick(d.widthUnit ?? d.unit, ["cm", "tai"] as const, "cm"),
    heightUnit: pick(d.heightUnit ?? d.unit, ["cm", "tai"] as const, "cm"),
    width: str(d.width),
    height: str(d.height),
    listPrice: str(d.listPrice),
    multiplier: str(d.multiplier),
    sameAsPrev: d.sameAsPrev === true,
    panel: pick(d.panel, ["", "single", "double"] as const, ""),
    side: pick(d.side, ["", "left", "right"] as const, ""),
    mount: pick(d.mount, ["", "ceiling", "wall", "direct"] as const, ""),
    wallOption: pick(d.wallOption, ["", "shift", "frame"] as const, ""),
    shiftChi: str(d.shiftChi),
    installNote: str(d.installNote),
    note: str(d.note),
  };
}

function mapOrder(id: string, d: DocumentData): SalesOrder {
  return {
    id,
    ownerId: str(d.ownerId),
    person: str(d.person),
    kind: d.kind === "sales" ? "sales" : "company",
    orderDate: str(d.orderDate),
    installTime: str(d.installTime),
    scheduledInstallTime: str(d.scheduledInstallTime),
    customerName: str(d.customerName),
    phone: str(d.phone),
    address: str(d.address),
    total: num(d.total),
    deposit: num(d.deposit),
    depositMethod: pick(d.depositMethod, PAY, ""),
    balanceMethod: pick(d.balanceMethod, PAY, ""),
    notes: str(d.notes),
    status: pick(d.status, STATUSES, "draft"),
    editRequestStatus: pick(d.editRequestStatus, EDIT_REQUEST_STATUSES, ""),
    editRequestReason: str(d.editRequestReason),
    editRequestAt: str(d.editRequestAt),
    editReviewedAt: str(d.editReviewedAt),
    editReviewedBy: str(d.editReviewedBy),
    editApproved: d.editApproved === true,
    printEmphasis: Array.isArray(d.printEmphasis) ? d.printEmphasis.filter((m: unknown): m is SalesPrintMark => {
      if (!m || typeof m !== "object") return false;
      const mark = m as Record<string, unknown>;
      return typeof mark.field === "string" && typeof mark.text === "string" &&
        Number.isInteger(mark.start) && Number.isInteger(mark.end) &&
        (mark.start as number) >= 0 && (mark.end as number) > (mark.start as number);
    }) : [],
    windows: Array.isArray(d.windows) ? d.windows.map(mapWindow) : [],
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
    submittedAt: str(d.submittedAt),
    orderedAt: str(d.orderedAt),
    orderedBy: str(d.orderedBy),
  };
}

/** 最近有動靜的排前面（送出時間優先，沒有就看最後修改）。 */
const byRecent = (a: SalesOrder, b: SalesOrder): number =>
  (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt);

/**
 * 查詢刻意只用「單一條件」，排序在這裡自己做，
 * 這樣 Firebase 不需要另外建立複合索引。
 */

/** 業務自己的單（安全規則只允許查自己的）。 */
export async function fetchMySalesOrders(uid: string): Promise<SalesOrder[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("ownerId", "==", uid)));
  return snap.docs.map((d) => mapOrder(d.id, d.data())).sort(byRecent);
}

/** 管理者用：依狀態取全部業務的單。 */
export async function fetchSalesOrdersByStatus(status: SalesStatus): Promise<SalesOrder[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("status", "==", status)));
  return snap.docs.map((d) => mapOrder(d.id, d.data())).sort(byRecent);
}

/** 管理者待審核的訂單修改申請。 */
export async function fetchSalesOrdersWithEditRequests(): Promise<SalesOrder[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("editRequestStatus", "==", "pending")));
  return snap.docs.map((d) => mapOrder(d.id, d.data())).sort(byRecent);
}

export async function fetchSalesOrder(id: string): Promise<SalesOrder | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? mapOrder(snap.id, snap.data()) : null;
}

/** 依多個 id 取單（列印頁用）；讀不到的會略過。 */
export async function fetchSalesOrdersByIds(ids: string[]): Promise<SalesOrder[]> {
  const found = await Promise.all(
    ids.map((id) => fetchSalesOrder(id).catch(() => null)),
  );
  return found.filter((o): o is SalesOrder => o !== null);
}

/** Firestore 不收 undefined，這裡把輸入整理成乾淨的純資料。 */
const toData = (input: SalesOrderInput): DocumentData => ({
  ownerId: input.ownerId,
  person: input.person,
  kind: input.kind,
  orderDate: input.orderDate,
  installTime: input.installTime,
  scheduledInstallTime: input.scheduledInstallTime,
  customerName: input.customerName,
  phone: input.phone,
  address: input.address,
  total: input.total,
  deposit: input.deposit,
  depositMethod: input.depositMethod,
  balanceMethod: input.balanceMethod,
  notes: input.notes,
    status: input.status,
    editRequestStatus: input.editRequestStatus,
    editRequestReason: input.editRequestReason,
    editRequestAt: input.editRequestAt,
    editReviewedAt: input.editReviewedAt,
    editReviewedBy: input.editReviewedBy,
    editApproved: input.editApproved,
    windows: input.windows.map((w) => ({ ...w })),

});

export async function createSalesOrder(input: SalesOrderInput): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...toData(input),
    createdAt: now,
    updatedAt: now,
    submittedAt: input.status === "submitted" ? now : "",
    orderedAt: "",
    orderedBy: "",
  });
  return ref.id;
}

/**
 * 儲存修改。`ownerId` 不會被改動（管理者修改別人的單時，單仍屬於原業務）；
 * 從草稿變成「待下單」時記下送出時間。
 */
export async function updateSalesOrder(
  id: string,
  input: SalesOrderInput,
  previousStatus: SalesStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const data: DocumentData = { ...toData(input), updatedAt: now };
  delete data.ownerId;
  if (input.status === "submitted" && previousStatus !== "submitted") data.submittedAt = now;
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function saveSalesPrintEmphasis(
  id: string,
  expectedUpdatedAt: string,
  marks: SalesPrintMark[],
): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || str(snapshot.data().updatedAt) !== expectedUpdatedAt) {
      throw new Error("訂單已被更新，請重新載入後再標記。");
    }
    transaction.update(ref, { printEmphasis: marks, updatedAt: new Date().toISOString() });
  });
}

export async function deleteSalesOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** 業務為已送出的單提出修改申請；申請待審期間訂單維持鎖定。 */
export async function requestSalesOrderEdit(id: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, COLLECTION, id), {
    editRequestStatus: "pending",
    editRequestReason: reason.trim(),
    editRequestAt: now,
    editApproved: false,
    updatedAt: now,
  });
}

/** 管理者核准或拒絕修改申請。核准後維持開放，直到管理者手動鎖定。 */
export async function reviewSalesOrderEdit(
  id: string,
  approved: boolean,
  by: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, COLLECTION, id), {
    editRequestStatus: approved ? "approved" : "rejected",
    editApproved: approved,
    editReviewedAt: now,
    editReviewedBy: by,
    updatedAt: now,
  });
}

/** 管理者重新鎖定已核准開放修改的訂單。 */
export async function lockSalesOrderEdits(id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, COLLECTION, id), {
    editRequestStatus: "",
    editApproved: false,
    updatedAt: now,
  });
}

/** 管理者：把幾張單標記為「已下單」。 */
export async function markSalesOrdered(ids: string[], by: string): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, COLLECTION, id), {
      status: "ordered",
      orderedAt: now,
      orderedBy: by,
      updatedAt: now,
    });
  }
  await batch.commit();
}

/** 管理者：誤按「已下單」時改回待下單。 */
export async function reopenSalesOrders(ids: string[]): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, COLLECTION, id), {
      status: "submitted",
      orderedAt: "",
      orderedBy: "",
      updatedAt: now,
    });
  }
  await batch.commit();
}

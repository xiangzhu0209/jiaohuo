import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { SalesMember, SalesMemberStatus } from "./sales-types";
import { ADMIN_EMAILS } from "./sales-types";

const MEMBERS = "sales_members";

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const statusOf = (value: unknown): SalesMemberStatus =>
  value === "active" || value === "disabled" ? value : "pending";

function mapMember(uid: string, value: Record<string, unknown>): SalesMember {
  return {
    uid,
    email: text(value.email),
    name: text(value.name),
    status: statusOf(value.status),
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
    approvedAt: text(value.approvedAt),
  };
}

/** 業務註冊後先建立待核准紀錄。 */
export async function registerSalesMember(uid: string, email: string, name: string): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(doc(db, MEMBERS, uid), {
    uid,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    approvedAt: "",
  });
}

/** 管理者查看所有已列入業務帳號管理的使用者。 */
export async function fetchSalesMembers(): Promise<SalesMember[]> {
  const snapshot = await getDocs(collection(db, MEMBERS));
  return snapshot.docs
    .map((item) => mapMember(item.id, item.data()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface SalesMemberCandidate {
  uid: string;
  email: string;
  name: string;
}

/** 找出已有帳號中尚未列入業務管理的使用者，供管理者明確加入。 */
export async function fetchSalesMemberCandidates(): Promise<SalesMemberCandidate[]> {
  const [profiles, members] = await Promise.all([
    getDocs(collection(db, "profiles")),
    getDocs(collection(db, MEMBERS)),
  ]);
  const managed = new Set(members.docs.map((item) => item.id));
  const admins = new Set(ADMIN_EMAILS.map((email) => email.toLowerCase()));
  return profiles.docs
    .map((item) => ({
      uid: item.id,
      email: text(item.data().email).trim(),
      name: text(item.data().name).trim(),
    }))
    .filter((profile) =>
      profile.email && !managed.has(profile.uid) && !admins.has(profile.email.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));
}

/** 管理者將已存在的系統帳號加入業務名單，仍須再核准才能使用。 */
export async function enrollSalesMember(
  uid: string,
  email: string,
  name: string,
): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(doc(db, MEMBERS, uid), {
    uid,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    approvedAt: "",
  });
  batch.update(doc(db, "profiles", uid), { accountType: "business", updatedAt: now });
  await batch.commit();
}

/** 管理者核准、停用或重新啟用；停用保留帳號與既有訂單。 */
export async function updateSalesMemberStatus(
  uid: string,
  status: SalesMemberStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, string> = { status, updatedAt: now };
  if (status === "active") patch.approvedAt = now;
  await updateDoc(doc(db, MEMBERS, uid), patch);
}

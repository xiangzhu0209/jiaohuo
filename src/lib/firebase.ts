import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase 專案設定。
 *
 * 這些值都是「公開識別碼」，寫在原始碼裡是安全的（前端本來就看得見）；
 * 真正的保護來自 Firestore 安全規則與 Firebase Authentication。
 * 若要換成別的 Firebase 專案，只要改這個檔案裡的欄位即可。
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAjPoUqwTYBnnSQMY8p-PWEowpAayBPpTA",
  authDomain: "order-management-7fcd8.firebaseapp.com",
  projectId: "order-management-7fcd8",
  storageBucket: "order-management-7fcd8.firebasestorage.app",
  messagingSenderId: "687134157436",
  appId: "1:687134157436:web:c71e98446cea37505fb7f9",
  measurementId: "G-KYXYPKP03E",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/**
 * App 目前的網址根目錄（含 GitHub Pages 的子路徑，例如
 * https://user.github.io/jiaohuo/）。用來組密碼重設信寄回來的網址。
 */
export function appBaseUrl(): string {
  if (typeof window === "undefined") return "/";
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, "");
}

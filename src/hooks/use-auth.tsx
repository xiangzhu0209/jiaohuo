import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  updateProfile as firebaseUpdateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { appBaseUrl, auth, db } from "@/lib/firebase";
import {
  getOfflineUser,
  isOfflineMode,
  setOfflineMode,
  setOfflineUser,
} from "@/lib/db-offline";

/** 目前登入者（只需要 id 與 email）。 */
export interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  profileName: string;
  /** 使用離線備案（連不上時先下單，資料存在這台電腦） */
  offline: boolean;
  startOffline: (name: string) => void;
  stopOffline: () => void;
  /** 使用者是從「重設密碼」信件連結進來的，需先設定新密碼 */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<{ error: string | null }>;
  /** 寄出重設密碼信 */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** 在重設流程中設定新密碼 */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  /** 結束重設流程（不論成功或放棄） */
  completeRecovery: () => void;
}

/**
 * 「重設密碼」信會把使用者帶回這個網址，並在網址後面帶上
 * mode=resetPassword 與 oobCode。App 用 hash router，所以參數可能落在
 * ?query 或 #...?query，兩種都找一次；在模組載入時就讀取，避免被路由清掉。
 */
function readResetCode(): string | null {
  if (typeof window === "undefined") return null;
  const candidates: string[] = [window.location.search];
  const hash = window.location.hash;
  const qi = hash.indexOf("?");
  if (qi >= 0) candidates.push(hash.slice(qi));

  for (const raw of candidates) {
    const params = new URLSearchParams(raw);
    if (params.get("mode") === "resetPassword") {
      const code = params.get("oobCode");
      if (code) return code;
    }
  }
  return null;
}

/** 把 Firebase 的錯誤代碼翻成看得懂的中文。 */
function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "信箱格式不正確";
    case "auth/missing-password":
    case "auth/missing-email":
      return "請輸入信箱與密碼";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "信箱或密碼不正確";
    case "auth/email-already-in-use":
      return "這個信箱已經註冊過了，請直接登入";
    case "auth/weak-password":
      return "密碼強度不足（至少 6 碼）";
    case "auth/too-many-requests":
      return "嘗試次數過多，請稍後再試";
    case "auth/network-request-failed":
      return "連線失敗，請檢查網路";
    case "auth/unauthorized-domain":
      return "這個網址還沒加入 Firebase 的授權網域";
    case "auth/operation-not-allowed":
      return "這個登入方式還沒在 Firebase 開啟";
    case "auth/expired-action-code":
      return "重設連結已過期，請回登入頁重新申請";
    case "auth/invalid-action-code":
      return "重設連結無效或已使用過，請重新申請";
    default:
      return `發生錯誤（${code}）`;
  }
}

function toMessage(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string" && code) return authErrorMessage(code);
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message ? message : "發生未知錯誤";
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(readResetCode);
  const [offline, setOffline] = useState(isOfflineMode);
  const [offlineName, setOfflineName] = useState(getOfflineUser);

  /** 姓名存在 profiles/{uid}；讀不到就退回 Firebase 帳號的 displayName。 */
  const loadProfile = useCallback(async (uid: string, fallback: string) => {
    const ref = doc(db, "profiles", uid);
    try {
      const snap = await getDoc(ref);
      const saved = snap.exists() ? String(snap.data().name ?? "") : "";
      if (saved) {
        setProfileName(saved);
        return;
      }
      setProfileName(fallback);
      await setDoc(ref, { name: fallback, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {
      // 讀寫失敗（例如規則未部署）也不該擋住下單，先用帳號上的名字。
      setProfileName(fallback);
    }
  }, []);

  useEffect(() => {
    // 離線模式：完全不碰後端，直接讓使用者進系統
    if (offline) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email });
        setLoading(false);
        void loadProfile(firebaseUser.uid, firebaseUser.displayName ?? "");
      } else {
        setUser(null);
        setProfileName("");
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [loadProfile, offline]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { error: null };
    } catch (error) {
      return { error: toMessage(error) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const trimmed = name.trim();
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await firebaseUpdateProfile(credential.user, { displayName: trimmed });
      await setDoc(
        doc(db, "profiles", credential.user.uid),
        { name: trimmed, email: email.trim(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setProfileName(trimmed);
      return { error: null };
    } catch (error) {
      return { error: toMessage(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isOfflineMode()) {
      setOfflineMode(false);
      setOfflineUser("");
      setOffline(false);
      setOfflineName("");
      return;
    }
    await firebaseSignOut(auth);
  }, []);

  /** 進入離線備案：輸入姓名即可開始下單（不驗證身分，資料只在這台電腦）。 */
  const startOffline = useCallback((name: string) => {
    const trimmed = name.trim();
    setOfflineMode(true);
    setOfflineUser(trimmed);
    setOffline(true);
    setOfflineName(trimmed);
  }, []);

  const stopOffline = useCallback(() => {
    setOfflineMode(false);
    setOfflineUser("");
    setOffline(false);
    setOfflineName("");
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${appBaseUrl()}?mode=resetPassword`,
        handleCodeInApp: false,
      });
      return { error: null };
    } catch (error) {
      return { error: toMessage(error) };
    }
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      try {
        if (recoveryCode) {
          await confirmPasswordReset(auth, recoveryCode, password);
        } else if (auth.currentUser) {
          await firebaseUpdatePassword(auth.currentUser, password);
        } else {
          return { error: "重設連結已失效，請重新申請" };
        }
        return { error: null };
      } catch (error) {
        return { error: toMessage(error) };
      }
    },
    [recoveryCode],
  );

  const completeRecovery = useCallback(() => {
    setRecoveryCode(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
  }, []);

  const updateProfile = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "請輸入姓名" };
      if (isOfflineMode()) {
        setOfflineUser(trimmed);
        setOfflineName(trimmed);
        return { error: null };
      }
      if (!auth.currentUser) return { error: "尚未登入" };
      try {
        await setDoc(
          doc(db, "profiles", auth.currentUser.uid),
          { name: trimmed, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        await firebaseUpdateProfile(auth.currentUser, { displayName: trimmed });
        setProfileName(trimmed);
        return { error: null };
      } catch (error) {
        return { error: toMessage(error) };
      }
    },
    [],
  );

  // 離線模式時提供一個本機身分，讓需要登入的頁面與「出單人」照常運作
  const effectiveUser: AuthUser | null = offline
    ? { id: "offline-local", email: null }
    : user;
  const effectiveProfileName = offline ? offlineName : profileName;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        loading,
        profileName: effectiveProfileName,
        offline,
        startOffline,
        stopOffline,
        recovery: recoveryCode !== null,
        signIn,
        signUp,
        signOut,
        updateProfile,
        resetPassword,
        updatePassword,
        completeRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

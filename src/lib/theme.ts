import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/**
 * 舊版曾把「系統偵測結果」自動寫進 localStorage，害使用者重新整理後
 * 莫名被套成深色。改用新的 key，讓那些不是使用者主動選擇的值失效。
 */
const STORAGE_KEY = "order-theme";

const listeners = new Set<() => void>();
let current: Theme | null = null;

/**
 * 預設一律淺色（墨綠＋金色的主要樣貌）。
 * 只有使用者按過切換才會記住深色 —— 不跟隨系統設定，
 * 否則一登入整個介面變近黑，會像「品牌綠色不見了」。
 */
function detectTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // 少數環境（例如 iframe 被封鎖儲存空間）會直接丟錯，忽略即可
  }
  return "light";
}

/** 目前主題（惰性初始化，全 App 共用同一份狀態）。 */
function getTheme(): Theme {
  if (!current) current = detectTheme();
  return current;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/** 在 React 掛載前先套用，避免畫面閃爍。 */
export function bootstrapTheme() {
  applyTheme(getTheme());
}

function setTheme(next: Theme) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 無法寫入時仍可在這個瀏覽階段正常切換
  }
  applyTheme(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);

  const toggleTheme = useCallback(() => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggleTheme };
}

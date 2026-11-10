import { toast } from "sonner";

/**
 * 呼叫瀏覽器列印，並偵測「按了沒反應」的情況。
 *
 * 手機上常見的狀況：LINE／Facebook／Instagram 內建瀏覽器、iPhone 版 Chrome 等，
 * 會直接忽略 window.print()，畫面完全沒有反應。
 * 這裡的做法：呼叫後等一下，如果瀏覽器沒有發出 beforeprint 事件，
 * 就跳出提示，告訴使用者改用別的方式（可以額外帶一個按鈕，例如「匯出圖片」）。
 */
export function printPage(fallback?: { label: string; run: () => void }): void {
  let started = false;
  const onBefore = () => {
    started = true;
  };
  window.addEventListener("beforeprint", onBefore, { once: true });

  const hint = () =>
    toast("如果沒有跳出列印畫面，這個瀏覽器可能不支援直接列印", {
      description: "請改用 Safari 或 Chrome 開啟這個網頁（不要在 LINE 裡開），或先匯出成圖片再列印。",
      duration: 12000,
      action: fallback ? { label: fallback.label, onClick: fallback.run } : undefined,
    });

  try {
    window.print();
  } catch {
    window.removeEventListener("beforeprint", onBefore);
    hint();
    return;
  }

  window.setTimeout(() => {
    window.removeEventListener("beforeprint", onBefore);
    if (!started) hint();
  }, 800);
}

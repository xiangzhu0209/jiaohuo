/*
 * 離線快取：讓「加到手機桌面」的 App 在沒訊號時也開得起來。
 *
 * - 網頁本身（HTML）：先連網路拿最新版，連不上才用快取 → 有新版本一定看得到。
 * - 打包後的檔案（/assets/ 內、檔名帶雜湊）與字型：先看快取，沒有才連網路。
 * - 資料本身另外有「離線模式」（存在這台裝置的瀏覽器），兩者不衝突。
 */
const CACHE = "jiaohuo-app-v1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** 放進快取（只存讀得到的正常回應；跨來源的 opaque 回應不存）。 */
async function putInCache(request, response) {
  if (response && response.ok && response.type !== "opaque") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1) 開網頁：先網路（取得最新版），離線時用快取
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await putInCache(request, await fetch(request));
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match("./index.html")) ||
            new Response("目前沒有網路，請稍後再試", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // 2) 打包檔與字型：先快取
  const sameOriginAsset =
    url.origin === self.location.origin && url.pathname.includes("/assets/");
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOriginAsset && !isFont) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        return await putInCache(request, await fetch(request));
      } catch {
        return new Response("", { status: 504 });
      }
    })(),
  );
});

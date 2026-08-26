/* The More — 서비스워커 (cache-first)
 * 앱 셸을 캐시해 오프라인·약한 신호에서도 즉시 로드하고, 런타임 네트워크를 최소화한다.
 * CACHE 버전은 pre-commit 훅(hooks/pre-commit)이 셸 내용 해시로 자동 스탬프하므로
 * 수동으로 올릴 필요가 없다. 셸이 실제로 바뀐 커밋에서만 버전이 바뀌어 자동 갱신된다.
 */
const CACHE = "themore-d82bab2141";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // cache:"reload"로 HTTP 캐시를 우회해 항상 최신 셸을 캐싱한다 (GitHub Pages 캐시 회피).
  // install은 sw.js가 바뀐(=새 버전) 경우에만 실행되므로 평소엔 네트워크 비용이 없다.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 외부 환율 API 등 교차 출처는 캐시하지 않고 네트워크로 통과
  if (url.origin !== self.location.origin) return;

  // 앱 셸: 캐시 우선(빠름·저데이터), 없으면 네트워크 (받으면 캐시에 보관)
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match("./index.html"))
    )
  );
});

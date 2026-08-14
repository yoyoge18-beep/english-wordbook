/* 나만의 단어장 — 오프라인 지원 서비스워커
 *
 * 학습 기록은 localStorage에 있고 서비스워커는 거기에 손대지 않는다.
 * 여기서 다루는 건 앱 파일(HTML/아이콘/manifest)을 저장해 두는 일뿐이다.
 *
 * 앱을 고쳐서 새로 올릴 때는 VERSION을 올린다. 그래야 예전 캐시가 지워진다.
 */
const VERSION = "v2";
const CACHE = `wordbook-${VERSION}`;

/* 이게 있어야 비행기 모드에서도 앱이 열린다 */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      /* 하나라도 실패하면 addAll이 통째로 실패하므로 개별로 담는다 */
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 화면 열기: 온라인이면 항상 최신을 쓰고, 끊겼을 때만 저장해 둔 걸 쓴다.
     반대로 하면 앱을 고쳐 올려도 낡은 화면에 계속 갇힌다. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() =>
          caches
            .match("./index.html", { ignoreSearch: true })
            .then((hit) => hit || caches.match("./"))
        )
    );
    return;
  }

  /* 아이콘·manifest는 거의 안 바뀌니 저장해 둔 걸 먼저 주고, 뒤에서 조용히 갱신한다 */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

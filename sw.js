const CACHE = 'checklist-v2';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 网络优先：每次都先尝试拉取最新文件，保证 Cloudflare 部署后手机能立即看到更新；
  // 仅在断网时回退到本地缓存，保证离线可用。
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

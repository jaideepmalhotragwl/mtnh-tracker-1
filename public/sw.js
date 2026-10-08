// ─────────────────────────────────────────────────────────────────
// OFFLINE SHELL
//
// What this caches is the app itself — the screen, not the data. Site
// records, photos and messages are always fetched live, because a
// tracker showing yesterday's stage with no sign that it is stale is
// worse than one that says it cannot reach the server.
//
// The page itself is network-first. That matters: a cached index.html
// would pin the team to an old build after every deploy, and nobody
// here can clear a service worker by hand.
// ─────────────────────────────────────────────────────────────────

const VERSION = 'mtnh-v3'
const SHELL = `${VERSION}-shell`

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(['/', '/icon-192.png', '/icon-512.png']))
      .catch(() => {})       // a cold install offline shouldn't fail
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Anything that isn't ours — Supabase, storage, fonts — goes straight
  // out. Never cache data, never cache an upload.
  if (url.origin !== self.location.origin) return

  // The page: try the network, fall back to the last good copy. This is
  // what makes a new deploy land immediately while still opening in a
  // lift with no signal.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(SHELL).then(c => c.put('/', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/').then(r => r || offlineCard()))
    )
    return
  }

  // Built files carry a content hash in the name, so a cached one can
  // never be the wrong version — serve it instantly and keep it.
  if (url.pathname.startsWith('/assets/') ||
      /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit =>
        hit || fetch(req).then(res => {
          const copy = res.clone()
          caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {})
          return res
        })
      )
    )
  }
})

function offlineCard() {
  return new Response(
    `<!doctype html><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
                 display:grid;place-items:center;height:100vh;margin:0;
                 color:#111827;text-align:center;padding:24px">
       <div>
         <div style="font-weight:700;font-size:15px">MTNH</div>
         <p style="color:#6b7280;font-size:14px;max-width:260px">
           No connection. Open this again once you have signal.
         </p>
       </div>
     </div>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

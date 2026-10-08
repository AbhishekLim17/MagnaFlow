// MagnaFlow service worker: makes the app installable and shows push notifications sent by
// the mail job (scripts/lib/push.cjs, Firebase Cloud Messaging, data-only messages).
// No caching on purpose: every page load gets the current deploy.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const data = payload.data || payload;
  const note = payload.notification || {};
  const title = note.title || data.title || 'MagnaFlow';
  event.waitUntil(self.registration.showNotification(title, {
    body: note.body || data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    data: { link: data.link || '/' },
  }));
});

// Open (or focus) the app where the notification points.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = open.find((c) => c.url.startsWith(self.location.origin));
    if (same) { await same.focus(); return same.navigate(target).catch(() => {}); }
    return self.clients.openWindow(target);
  })());
});

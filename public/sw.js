// Web Push Service Worker — SSG Admin
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: '알림', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '영업 알림';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || 'ssg-notification',
    data: { url: data.url || '/' },
    requireInteraction: false,
    vibrate: data.vibrate || [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
// Shows push notifications while the site is closed or in the background (Firebase Cloud Messaging).
// No Firebase SDK is needed here: FCM delivers { notification: { title, body }, data: { link } }.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    return;
  }
  const n = payload.notification || {};
  const link = (payload.data && payload.data.link) || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Tell open tabs to refresh their bell, and only show a system notification when no tab is in view.
      wins.forEach((w) => w.postMessage({ type: 'lms-push' }));
      if (wins.some((w) => w.visibilityState === 'visible')) return undefined;
      return self.registration.showNotification(n.title || 'LMS', { body: n.body || '', data: { link }, icon: '/favicon.ico' });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.link) || '/notifications';
  const path = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      if (open) return open.navigate(path).then((c) => c && c.focus());
      return self.clients.openWindow(path);
    }),
  );
});

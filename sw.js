// Bibla Apps — Service Worker

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || 'Bibla Apps';
  var body  = data.body  || 'A chore was completed!';
  event.waitUntil(
    self.registration.showNotification(title, {
      body:     body,
      icon:     '/icon-192.png',
      tag:      'bibla-chore',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('https://biblix.io/chores.html'));
});

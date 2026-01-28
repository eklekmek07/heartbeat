// HeartBeat Service Worker

const CACHE_NAME = 'heartbeat-v4';
const IMAGE_CACHE_NAME = 'heartbeat-images-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/scripts.js',
  '/manifest.webmanifest'
];

// Install - cache essential files
self.addEventListener('install', (event) => {
  console.log('HeartBeat SW: Installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('HeartBeat SW: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Cache Vercel Blob images (backgrounds and message images)
  if (event.request.url.includes('blob.vercel-storage.com')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached, but also update cache in background
            fetch(event.request).then((response) => {
              if (response.status === 200) {
                cache.put(event.request, response);
              }
            });
            return cachedResponse;
          }
          // Not in cache, fetch and cache
          return fetch(event.request).then((response) => {
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('HeartBeat SW: Push received');

  let data = { title: 'HeartBeat', body: 'You have a new message!' };

  try {
    data = event.data.json();
  } catch (e) {
    console.error('Failed to parse push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/favicon.png',
    tag: 'heartbeat-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || data
  };

  // Add image for Android (shows as big picture)
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('HeartBeat SW: Notification clicked');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ message: 'notification-clicked', data: event.notification.data });
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

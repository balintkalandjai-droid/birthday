// ============================================================
// Birthday Buddy - Service Worker
// Timer + Stopwatch értesítések ÉS offline cache egyben
// ============================================================

const CACHE_NAME = 'birthday-buddy-v1';

// -------------------------------------------------------
// MEGLÉVŐ: Timer / Stopwatch állapot
// -------------------------------------------------------
let timerInterval = null;
let timerEnd = null;
let timerName = '';

// -------------------------------------------------------
// MEGLÉVŐ: Message handler (timer, stopwatch, countdown)
// -------------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'timer-start') {
    timerEnd = data.endTime;
    timerName = data.name || 'Időzítő';
    startTimerNotification();
  }
  if (data.type === 'timer-stop') {
    stopTimerNotification();
  }
  if (data.type === 'stopwatch-update') {
    self.registration.showNotification('⏱️ Stopper fut', {
      body: data.time + ' eltelt',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'stopwatch-running',
      renotify: false,
      silent: true,
      requireInteraction: false,
    });
  }
  if (data.type === 'stopwatch-stopped') {
    self.registration.getNotifications({ tag: 'stopwatch-running' }).then(ns => ns.forEach(n => n.close()));
    self.registration.showNotification('⏱️ Stopper megállítva', {
      body: 'Mért idő: ' + data.time,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'stopwatch-result',
      requireInteraction: false,
      vibrate: [200, 100, 200],
    });
  }
  if (data.type === 'stopwatch-stop') {
    self.registration.getNotifications({ tag: 'stopwatch-running' }).then(ns => ns.forEach(n => n.close()));
  }
  if (data.type === 'event-countdown') {
    self.registration.showNotification('📅 ' + data.name, {
      body: data.time + ' van hátra',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'event-live-' + data.name,
      renotify: false,
      silent: true,
      requireInteraction: false,
    });
  }
});

// -------------------------------------------------------
// MEGLÉVŐ: Timer segédfüggvények
// -------------------------------------------------------
function fmtSecs(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function startTimerNotification() {
  if (timerInterval) clearInterval(timerInterval);
  const update = () => {
    if (!timerEnd) return;
    const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    if (left <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      self.registration.showNotification('⏰ ' + timerName + ' lejárt!', {
        body: 'Az időzítő lejárt!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'timer-done',
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400],
        actions: [{ action: 'open', title: 'Megnyitás' }]
      });
      return;
    }
    self.registration.showNotification('⏰ ' + timerName, {
      body: fmtSecs(left) + ' van hátra',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'timer-running',
      renotify: false,
      silent: true,
      requireInteraction: false,
    });
  };
  update();
  timerInterval = setInterval(update, 1000);
}

function stopTimerNotification() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerEnd = null;
  self.registration.getNotifications({ tag: 'timer-running' }).then(ns => ns.forEach(n => n.close()));
}

// -------------------------------------------------------
// MEGLÉVŐ: Push értesítés handler
// -------------------------------------------------------
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  if (data.type === 'timer-start') {
    timerEnd = data.endTime;
    timerName = data.name || 'Időzítő';
    startTimerNotification();
    return;
  }
  if (data.type === 'timer-stop') { stopTimerNotification(); return; }

  const title = data.title || 'Birthday Buddy';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Megnyitás' },
      { action: 'close', title: 'Bezárás' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// -------------------------------------------------------
// MEGLÉVŐ: Értesítésre kattintás handler
// -------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// -------------------------------------------------------
// ÚJ: Install - cache az alapoldalt
// (a régi csak self.skipWaiting() volt, ez bővebb)
// -------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/').then(response => {
      return caches.open(CACHE_NAME).then(cache => cache.put('/', response));
    }).catch(() => {})
  );
  self.skipWaiting();
});

// -------------------------------------------------------
// ÚJ: Activate - régi cache törlése + clients.claim
// -------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Régi cache-ek törlése
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      // Meglévő: azonnal átveszi az irányítást
      clients.claim()
    ])
  );
});

// -------------------------------------------------------
// ÚJ: Fetch - offline cache stratégia
// -------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Külső API (időjárás /api/weather is ide esik ha külső) -> Network First
  // Ha offline: cache-ből, vagy JSON {offline: true}
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ offline: true, error: 'Nincs internetkapcsolat' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          })
        )
    );
    return;
  }

  // Saját fájlok (HTML, CSS, JS, képek) -> Cache First + háttérfrissítés
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Navigációnál (oldal újratöltés) -> cached index
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });

      return cached || networkFetch;
    })
  );
});

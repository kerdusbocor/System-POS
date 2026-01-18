/**
 * Service Worker for Universal POS PWA
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'pos-cache-v1';
const RUNTIME_CACHE = 'pos-runtime-v1';

// Files to cache on install (app shell)
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/api.js',
    '/js/utils.js',
    '/js/auth.js',
    '/js/pos.js',
    '/js/products.js',
    '/js/customers.js',
    '/js/workorders.js',
    '/js/reports.js',
    '/js/app.js',
    '/manifest.json'
];

// API endpoints that should use network-first strategy
const API_ROUTES = [
    '/api/'
];

// =============================================================================
// INSTALL EVENT
// =============================================================================

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Precaching app shell');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('[ServiceWorker] Skip waiting');
                return self.skipWaiting();
            })
    );
});

// =============================================================================
// ACTIVATE EVENT
// =============================================================================

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        // Delete old caches
                        return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                    })
                    .map((cacheName) => {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[ServiceWorker] Claiming clients');
            return self.clients.claim();
        })
    );
});

// =============================================================================
// FETCH EVENT
// =============================================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests: Network first, fall back to cache
    if (isApiRequest(url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Static assets: Cache first, fall back to network
    event.respondWith(cacheFirst(request));
});

// =============================================================================
// CACHING STRATEGIES
// =============================================================================

/**
 * Cache First Strategy
 * Good for: Static assets (CSS, JS, images)
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        // Return cached version and update cache in background
        fetchAndCache(request);
        return cachedResponse;
    }

    return fetchAndCache(request);
}

/**
 * Network First Strategy
 * Good for: API requests, dynamic data
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline response for API
        return new Response(
            JSON.stringify({
                success: false,
                error: { code: 'OFFLINE', message: 'You are offline' }
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Fetch and cache response
 */
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);

        // Only cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const cache = await caches.open(CACHE_NAME);
            return cache.match('/index.html');
        }

        throw error;
    }
}

/**
 * Check if request is an API request
 */
function isApiRequest(url) {
    return API_ROUTES.some(route => url.pathname.startsWith(route));
}

// =============================================================================
// BACKGROUND SYNC
// =============================================================================

self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync event:', event.tag);

    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncPendingTransactions());
    }
});

/**
 * Sync pending transactions when back online
 */
async function syncPendingTransactions() {
    try {
        // Get pending transactions from IndexedDB
        // This would be implemented with actual IndexedDB logic
        console.log('[ServiceWorker] Syncing pending transactions...');

        // Notify clients that sync is complete
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                payload: { success: true }
            });
        });
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
    }
}

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received');

    let data = { title: 'POS Notification', body: 'New notification' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification clicked');

    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window or open new one
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

console.log('[ServiceWorker] Loaded');

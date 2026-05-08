const CACHE_NAME = 'cravebite-v4';
const APP_SHELL = [
    './',
    'index.html',
    'cart.html',
    'login.html',
    'register.html',
    'view-orders.html',
    'orders.html',
    'admin.html',
    'admin-login.html',
    'admin-register.html',
    'css/style.css',
    'js/app.js',
    'manifest.webmanifest',
    'img/icon-192.png',
    'img/icon-512.png',
    'img/upi-qr.jpeg',
    'img/Cravebite logo(new1) (2).png',
    'img/hero_banner_full.png',
    'img/burger.png',
    'img/pizza.png',
    'img/salad.png',
    'img/Paneer-Tikka-Featured-1.jpg',
    'img/Spaghetti-Carbonara-Plated.jpg',
    'img/hara-bhara-kabab.png',
    'img/Gemini_Generated_Image_6httga6httga6htt.png',
    'img/Gemini_Generated_Image_jn9tm2jn9tm2jn9t.png',
    'img/butter-chicken.png',
    'img/dal-makhani.png',
    'img/goan-prawn-curry.png',
    'img/garlic-naan.png',
    'img/burani-raita.png',
    'img/gulab-jamun.png',
    'img/mango-lassi.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => caches.match(event.request).then(response => response || caches.match('index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            });
        })
    );
});

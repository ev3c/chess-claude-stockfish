const CACHE_NAME = 'ajedrez-ia-v2.4.6';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './chess-logic.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './pieces/cburnett/wK.svg',
    './pieces/cburnett/wQ.svg',
    './pieces/cburnett/wR.svg',
    './pieces/cburnett/wB.svg',
    './pieces/cburnett/wN.svg',
    './pieces/cburnett/wP.svg',
    './pieces/cburnett/bK.svg',
    './pieces/cburnett/bQ.svg',
    './pieces/cburnett/bR.svg',
    './pieces/cburnett/bB.svg',
    './pieces/cburnett/bN.svg',
    './pieces/cburnett/bP.svg',
    './pieces/merida/wK.svg',
    './pieces/merida/wQ.svg',
    './pieces/merida/wR.svg',
    './pieces/merida/wB.svg',
    './pieces/merida/wN.svg',
    './pieces/merida/wP.svg',
    './pieces/merida/bK.svg',
    './pieces/merida/bQ.svg',
    './pieces/merida/bR.svg',
    './pieces/merida/bB.svg',
    './pieces/merida/bN.svg',
    './pieces/merida/bP.svg',
    './pieces/fantasy/wK.svg',
    './pieces/fantasy/wQ.svg',
    './pieces/fantasy/wR.svg',
    './pieces/fantasy/wB.svg',
    './pieces/fantasy/wN.svg',
    './pieces/fantasy/wP.svg',
    './pieces/fantasy/bK.svg',
    './pieces/fantasy/bQ.svg',
    './pieces/fantasy/bR.svg',
    './pieces/fantasy/bB.svg',
    './pieces/fantasy/bN.svg',
    './pieces/fantasy/bP.svg',
    './pieces/pixel/wK.svg',
    './pieces/pixel/wQ.svg',
    './pieces/pixel/wR.svg',
    './pieces/pixel/wB.svg',
    './pieces/pixel/wN.svg',
    './pieces/pixel/wP.svg',
    './pieces/pixel/bK.svg',
    './pieces/pixel/bQ.svg',
    './pieces/pixel/bR.svg',
    './pieces/pixel/bB.svg',
    './pieces/pixel/bN.svg',
    './pieces/pixel/bP.svg',
    './pieces/letter/wK.svg',
    './pieces/letter/wQ.svg',
    './pieces/letter/wR.svg',
    './pieces/letter/wB.svg',
    './pieces/letter/wN.svg',
    './pieces/letter/wP.svg',
    './pieces/letter/bK.svg',
    './pieces/letter/bQ.svg',
    './pieces/letter/bR.svg',
    './pieces/letter/bB.svg',
    './pieces/letter/bN.svg',
    './pieces/letter/bP.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.origin !== location.origin) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        fetch(event.request).then(response => {
            if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});

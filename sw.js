// sw.js — 숨 앱 Service Worker
// 전략: Network-First (온라인 시 항상 최신, 오프라인 시 캐시 폴백)

const CACHE_NAME = 'breath-app-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── 1. 설치: 핵심 파일 미리 캐시 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // 대기 없이 즉시 활성화
  );
});

// ── 2. 활성화: 구버전 캐시 정리 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME) // 현재 버전 외 전부 삭제
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // 열린 탭 즉시 제어
  );
});

// ── 3. 요청 처리: Network-First 전략 ──
self.addEventListener('fetch', event => {
  // GET 요청만 처리 (POST 등은 패스)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 유효한 응답이면 캐시 업데이트 후 반환
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // 네트워크 실패 → 캐시 폴백
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          // 캐시도 없으면 오프라인 안내 (HTML 요청일 때만)
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('오프라인 상태입니다.', { status: 503 });
        })
      )
  );
});

// ── 4. 푸시 알림 수신 ──
self.addEventListener('push', event => {
  const payload = event.data
    ? event.data.text()
    : '잠시 멈추고 숨을 고르세요. 오늘의 명상 시간입니다.';

  event.waitUntil(
    self.registration.showNotification('breathe. pause. return.', {
      body: payload,
      icon: './icon-192.png',
      badge: './icon-192.png',
      silent: true,
      vibrate: [],
    })
  );
});

// ── 5. 알림 클릭 시 앱 열기 ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 이미 앱이 열려있으면 포커스
        const existing = clientList.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
        if (existing) return existing.focus();
        // 없으면 새 탭으로 열기
        return clients.openWindow('./index.html');
      })
  );
});

const CACHE_NAME = 'puzzle-v1-production-fix';

// 1. ASSETS DINÁMICOS (Niveles)
const LEVEL_ASSETS = [];
const TOTAL_LEVELS = 20;

// ¡IMPORTANTE! Asegúrate de que TODOS estos archivos existan realmente.
// Si falta uno solo, la PWA no se instalará.
for (let i = 1; i <= TOTAL_LEVELS; i++) {
    LEVEL_ASSETS.push(`./assets/Nivel${i}.webp`);
    LEVEL_ASSETS.push(`./assets/thumbnails/Nivel${i}_thumb.webp`);
}

// 2. ASSETS ESTÁTICOS (App Shell)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/style.css',
  './src/main.js',
  './src/core/PuzzleEngine.js',
  './src/core/LevelManager.js',
  './src/systems/AudioSynth.js', 
  './src/systems/Storage.js',
  './src/systems/Economy.js',
  './src/ui/UIController.js',
  './levels.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  ...LEVEL_ASSETS
];

// --- INSTALACIÓN ---
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Iniciando caché masivo...');
        
        // Intentamos cachear todo. Si falla, capturamos el error para saber por qué.
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
            console.error('[SW] ERROR CRÍTICO AL CACHEAR:', err);
            // Esto te dirá en la consola si un archivo no existe (404)
            throw err; 
        });
      })
      .then(() => {
        console.log('[SW] Instalación completada con éxito.');
        return self.skipWaiting();
      })
  );
});

// --- ACTIVACIÓN ---
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- INTERCEPCIÓN (FETCH) ---
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // ESTRATEGIA 1: Fuentes de Google (Cache First + Network Fallback)
  // Esto permite que las fuentes funcionen offline
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request).then((fResponse) => {
          // Si la descargamos de internet, la guardamos en caché dinámicamente
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, fResponse.clone());
            return fResponse;
          });
        });
      })
    );
    return;
  }

  // ESTRATEGIA 2: Archivos Locales (Cache First)
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) {
        return response; // Encontrado en caché
      }
      
      // Si no está en caché, intentar bajarlo
      return fetch(e.request).catch(() => {
          // Si falla internet y no está en caché:
          console.warn('[SW] Fallo de red y no en caché:', e.request.url);
          // Aquí podrías retornar una imagen placeholder si es una imagen
      });
    })
  );
});

const CACHE_NAME = 'puzzle-v1-production';

// 1. Genera dinámicamente las rutas de los niveles para no escribir 20 líneas
const LEVEL_ASSETS = [];
const TOTAL_LEVELS = 20;

for (let i = 1; i <= TOTAL_LEVELS; i++) {
    // Imagen Full (Juego)
    LEVEL_ASSETS.push(`./assets/Nivel${i}.webp`);
    
    // Miniatura (Menú) - Descomentar la siguiente línea si ya están subidos los thumbnails
    // LEVEL_ASSETS.push(`./assets/thumbnails/Nivel${i}_thumb.webp`);
}

// 2. Lista maestra de archivos a cachear
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
  // Iconos de la PWA
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  // Expandimos la lista de niveles generada arriba
  ...LEVEL_ASSETS
];

// --- (Lógica Estándar) ---

// Instalación: Cachear assets estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando todo...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Forzar activación inmediata
  );
});

// Activación: Limpiar cachés viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Borrando cache viejo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Tomar control de inmediato
});

// Intercepción: Estrategia "Cache First, falling back to Network"
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Si está en cache, lo devolvemos
      if (response) {
        return response;
      }
      // Si no, lo pedimos a internet
      return fetch(e.request);
    })
  );
});

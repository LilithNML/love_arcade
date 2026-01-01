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

// --- INSTALACIÓN (MODO DIAGNÓSTICO) ---
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
        console.log('[SW] 🔍 Iniciando diagnóstico de archivos...');
        
        // En lugar de addAll, vamos uno por uno para ver cuál falla
        for (const asset of ASSETS_TO_CACHE) {
            try {
                // Intentamos buscar y cachear el archivo
                const response = await fetch(asset);
                if (!response.ok) {
                    throw new Error(`Status ${response.status}`);
                }
                await cache.put(asset, response);
                // console.log(`[OK] ${asset}`); // Descomenta si quieres ver los que sí funcionan
            } catch (err) {
                // ¡AQUÍ ESTÁ EL CULPABLE!
                console.error(`[SW] ❌ ERROR CRÍTICO: No se encuentra el archivo: ${asset}`);
                console.error(`     Causa: ${err.message}`);
            }
        }
        
        console.log('[SW] Diagnóstico finalizado. Revisa los errores rojos arriba.');
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

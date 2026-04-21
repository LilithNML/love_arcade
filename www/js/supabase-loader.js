(function initSupabaseSdkLoader(global) {
  'use strict';

  if (global.__supabaseLoader?.promise) {
    return;
  }

  const sources = [
    'vendor/supabase.umd.js'
  ];

  const hasClientFactory = () => typeof global.supabase?.createClient === 'function';

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const finish = (loaded) => {
    resolvePromise(Boolean(loaded));
  };

  const loadFrom = (index) => {
    if (hasClientFactory()) {
      console.info('[Boot] Supabase SDK disponible.');
      finish(true);
      return;
    }

    if (index >= sources.length) {
      console.warn('[Boot] No se pudo cargar Supabase SDK local. Sentinel operará en estado degradado.');
      finish(false);
      return;
    }

    const src = sources[index];
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if (hasClientFactory()) {
        console.info(`[Boot] Supabase SDK cargada desde: ${src}`);
        finish(true);
        return;
      }
      console.warn('[Boot] Supabase SDK cargado pero incompleto. Sentinel quedará en modo degradado.');
      loadFrom(index + 1);
    };

    script.onerror = () => {
      console.warn(`[Boot] Falló carga de Supabase SDK desde: ${src}`);
      loadFrom(index + 1);
    };

    document.head.appendChild(script);
  };

  global.__supabaseLoader = {
    sources,
    promise
  };

  global.__loadSupabaseSdk = function __loadSupabaseSdk() {
    return promise;
  };

  loadFrom(0);
})(window);

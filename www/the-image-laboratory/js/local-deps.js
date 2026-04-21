(function initImageLabLocalDeps(global) {
  'use strict';

  const checks = {
    jszip: () => typeof global.JSZip === 'function',
    cropper: () => typeof global.Cropper === 'function',
    lucide: () => Boolean(global.lucide?.createIcons)
  };

  const status = {
    jszip: checks.jszip(),
    cropper: checks.cropper(),
    lucide: checks.lucide()
  };

  global.__imageLabDeps = status;

  if (!status.lucide) {
    document.documentElement.classList.add('dep-no-lucide');
  }

  if (!status.jszip || !status.cropper) {
    console.warn('[ImageLab] Dependencias locales faltantes:', status);
  }
})(window);

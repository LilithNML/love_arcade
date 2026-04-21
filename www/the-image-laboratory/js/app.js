/**
 * app.js — Controlador Principal · The Image Laboratory
 *
 * Fixes aplicados:
 * 1. Downscale de imágenes >1600px antes de pasarlas a Cropper.js
 *    (previene crash con imágenes >9MP). Las coordenadas se reescalan
 *    al aplicar, devolviendo píxeles del original.
 * 2. Factores de escala _cropScaleX/_cropScaleY aplicados en getData()
 * 3. ZipBuilder: download con revoke aplazado correctamente
 * 4. Modal: onload asignado ANTES de src (race condition fix)
 */

// ─── Lucide Icons ─────────────────────────────────────────────────────────
export function initIcons(root = document) {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ nodes: root === document ? undefined : [root] });
  }
}

// ─── Toast System ──────────────────────────────────────────────────────────
const toastContainer = document.getElementById('toast-container');

/**
 * Muestra un toast de notificación.
 * @param {string} message
 * @param {'success'|'error'|'warn'|'info'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'info', duration = 4500) {
  const iconMap = { success: 'check-circle-2', error: 'alert-circle', warn: 'alert-triangle', info: 'info' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon"><i data-lucide="${iconMap[type] || 'info'}"></i></div>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });

  const dismiss = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 280);
  };

  const t = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => { clearTimeout(t); dismiss(); });
}

// ─── Global Progress Pill ─────────────────────────────────────────────────
const progressPill  = document.getElementById('global-progress');
const progressBar   = document.getElementById('global-progress-bar');
const progressLabel = document.getElementById('global-progress-label');

document.getElementById('global-progress-close').addEventListener('click', hideGlobalProgress);

export function showGlobalProgress(label = 'Procesando…') {
  progressBar.style.width = '0%';
  progressLabel.textContent = label;
  progressPill.classList.add('is-visible');
}

export function updateGlobalProgress(pct, label = null) {
  progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (label) progressLabel.textContent = label;
}

export function hideGlobalProgress() {
  progressPill.classList.remove('is-visible');
}

// ─── Crop Modal ────────────────────────────────────────────────────────────
const cropBackdrop   = document.getElementById('crop-modal-backdrop');
const cropDialog     = document.getElementById('crop-modal');
const cropImage      = document.getElementById('crop-image');
const cropLoading    = document.getElementById('crop-loading');
const cropApplyBtn   = document.getElementById('crop-apply-btn');
const cropResetBtn   = document.getElementById('crop-reset-btn');
const cropCloseBtn   = document.getElementById('crop-modal-close');
const cropAspectEl   = document.getElementById('crop-aspect-badge');
const cropFilenameEl = document.getElementById('crop-modal-filename');
const cropDimsEl     = document.getElementById('crop-dims');

let _cropper    = null;
let _cropCb     = null;
let _cropURL    = null;
let _cropScaleX = 1;   // factor: previewPx → originalPx en X
let _cropScaleY = 1;   // factor: previewPx → originalPx en Y

// ─── Downscale para crop (previene crash en imágenes >9MP) ─────────────────
/**
 * Si la imagen supera MAX_SIDE px en cualquier dimensión, la reduce a un
 * canvas de preview. Devuelve el blob de preview y los factores de escala
 * para mapear las coordenadas de vuelta a la imagen original.
 *
 * Límite: 1600px por lado → max ~2.5MP en canvas, estable en móviles.
 * Una imagen de 12MP (4000×3000) se reduciría a 1600×1200 (1.9MP).
 *
 * @param {File} file
 * @param {number} [maxSide=1600]
 * @returns {Promise<{blob: Blob|File, scaleX: number, scaleY: number, w: number, h: number}>}
 */
function downscaleForCrop(file, maxSide = 1600) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;

      // Si entra en el límite, devolvemos el archivo original sin modificar
      if (nw <= maxSide && nh <= maxSide) {
        resolve({ blob: file, scaleX: 1, scaleY: 1, w: nw, h: nh });
        return;
      }

      // Calcular dimensiones de preview manteniendo proporción
      const scale = Math.min(maxSide / nw, maxSide / nh);
      const pw    = Math.round(nw * scale);
      const ph    = Math.round(nh * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = pw;
      canvas.height = ph;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, pw, ph);

      // JPEG 0.88 es suficiente para Cropper.js
      canvas.toBlob(
        previewBlob => {
          resolve({
            blob:   previewBlob,
            scaleX: nw / pw,   // ← multiplicar coords del crop para volver a original
            scaleY: nh / ph,
            w:      nw,
            h:      nh,
          });
        },
        'image/jpeg',
        0.88,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: pasar el archivo original y escala 1:1
      resolve({ blob: file, scaleX: 1, scaleY: 1, w: 0, h: 0 });
    };

    img.src = url;
  });
}

/**
 * Abre el modal de recorte.
 *
 * FIX ALTA RESOLUCIÓN: antes de pasar la imagen a Cropper.js, se hace
 * un downscale a max 1600px usando un <canvas> en el hilo principal.
 * Los factores de escala se guardan en _cropScaleX/_cropScaleY y se
 * aplican al resultado de getData() para devolver coordenadas originales.
 *
 * @param {File}     file
 * @param {number|null} aspectRatio  16/9, 1, null=libre
 * @param {Function} callback        (cropData: {x,y,width,height}) => void
 */
export async function openCropModal(file, aspectRatio, callback) {
  _cropCb = callback;

  // Badge de aspect ratio
  const labels = { [16 / 9]: '16:9', [1]: '1:1', [4 / 3]: '4:3', [3 / 2]: '3:2' };
  cropAspectEl.textContent     = (aspectRatio != null) ? (labels[aspectRatio] || aspectRatio.toFixed(2)) : 'Libre';
  cropFilenameEl.textContent   = file.name;
  if (cropDimsEl) cropDimsEl.textContent = '';

  // Mostrar modal con spinner de carga
  cropLoading.classList.remove('hidden');
  cropImage.style.opacity = '0';
  _showModalDOM();

  // Destruir instancia anterior
  if (_cropper) { _cropper.destroy(); _cropper = null; }

  // Revocar URL anterior
  if (_cropURL) { URL.revokeObjectURL(_cropURL); _cropURL = null; }

  // DOWNSCALE: reducir si es >1600px (puede tardar ~100-300ms en imágenes grandes)
  const { blob: previewBlob, scaleX, scaleY, w, h } = await downscaleForCrop(file);
  _cropScaleX = scaleX;
  _cropScaleY = scaleY;

  // Mostrar dimensiones originales en el header
  if (cropDimsEl && w > 0) {
    cropDimsEl.textContent = `${w}×${h}px`;
    if (scaleX > 1) cropDimsEl.title = `Preview reducido a ${Math.round(w/scaleX)}×${Math.round(h/scaleY)}px para rendimiento`;
  }

  // Crear nueva URL (del preview)
  _cropURL = URL.createObjectURL(previewBlob);

  // Asignar onload ANTES de src (evita race condition con caché)
  cropImage.onload = function () {
    cropLoading.classList.add('hidden');
    cropImage.style.opacity = '1';

    _cropper = new Cropper(cropImage, {
      aspectRatio:           (aspectRatio != null) ? aspectRatio : NaN,
      viewMode:              1,
      dragMode:              'move',
      autoCropArea:          0.82,
      responsive:            true,
      restore:               true,
      guides:                true,
      center:                true,
      highlight:             false,
      cropBoxMovable:        true,
      cropBoxResizable:      true,
      toggleDragModeOnDblclick: false,
      ready() {
        if (aspectRatio != null) {
          const cw = this.cropper.getContainerData().width || 400;
          this.cropper.setCropBoxData({ left: 20, top: 20, width: cw - 40 });
        }
      },
    });
  };

  cropImage.onerror = function () {
    cropLoading.classList.add('hidden');
    showToast('No se pudo cargar la imagen para recortar.', 'error');
    closeCropModal();
  };

  cropImage.src = _cropURL;
}

function _showModalDOM() {
  cropBackdrop.classList.add('is-open');
  cropDialog.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

export function closeCropModal() {
  cropBackdrop.classList.remove('is-open');
  cropDialog.classList.remove('is-open');
  document.body.style.overflow = '';

  setTimeout(() => {
    if (_cropper) { _cropper.destroy(); _cropper = null; }
    cropImage.src    = '';
    cropImage.onload = null;
    cropImage.onerror = null;
    if (_cropURL) { URL.revokeObjectURL(_cropURL); _cropURL = null; }
    _cropScaleX = 1;
    _cropScaleY = 1;
  }, 300);

  _cropCb = null;
}

cropApplyBtn.addEventListener('click', () => {
  if (!_cropper || !_cropCb) return;

  // getData(true) → coordenadas en píxeles del PREVIEW
  const raw = _cropper.getData(true);

  // Reescalar a píxeles del ORIGINAL multiplicando por los factores de downscale
  const data = {
    x:      Math.round(raw.x      * _cropScaleX),
    y:      Math.round(raw.y      * _cropScaleY),
    width:  Math.round(raw.width  * _cropScaleX),
    height: Math.round(raw.height * _cropScaleY),
    rotate: raw.rotate  || 0,
    scaleX: raw.scaleX  || 1,
    scaleY: raw.scaleY  || 1,
  };

  const cb = _cropCb;
  closeCropModal();
  cb(data);
});

cropResetBtn.addEventListener('click', () => {
  if (_cropper) _cropper.reset();
});

cropCloseBtn.addEventListener('click', closeCropModal);
cropBackdrop.addEventListener('click', (e) => {
  // Solo cerrar si se hace clic directamente en el backdrop
  if (e.target === cropBackdrop) closeCropModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cropDialog.classList.contains('is-open')) {
    closeCropModal();
  }
});

// ─── Module Router ─────────────────────────────────────────────────────────
const navBtns      = document.querySelectorAll('.nav-btn');
const mainEl       = document.getElementById('app-main');
const loaderEl     = document.getElementById('module-loader');

let _activeModule  = null;

const MODULES = {
  'store-manager':     () => import('./modules/store-manager.js'),
  'puzzle-creator':    () => import('./modules/puzzle-creator.js'),
  'smart-compressor':  () => import('./modules/smart-compressor.js'),
  'filename-extractor':() => import('./modules/filename-extractor.js'),
};

async function loadModule(id) {
  // Permitir re-navegar al mismo módulo (e.g. para resetear estado)
  // El guard se aplica SOLO si el módulo ya está montado y no hubo cambio
  if (_activeModule === id) return;
  _activeModule = id;

  // Limpiar contenido anterior
  mainEl.innerHTML = '';
  mainEl.appendChild(loaderEl);
  loaderEl.style.display = 'flex';

  try {
    const importFn = MODULES[id];
    if (!importFn) throw new Error(`Módulo "${id}" no registrado.`);

    const mod = await importFn();
    loaderEl.style.display = 'none';

    if (typeof mod.mount !== 'function') {
      throw new Error(`El módulo "${id}" no exporta mount().`);
    }

    mod.mount(mainEl);
    initIcons(mainEl);

  } catch (err) {
    loaderEl.style.display = 'none';
    mainEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i data-lucide="alert-circle"></i></div>
        <p class="empty-state__title">Error al cargar el módulo</p>
        <p class="empty-state__sub" style="color:var(--c-danger);font-family:var(--font-mono);font-size:0.78rem">${err.message}</p>
      </div>
    `;
    initIcons(mainEl);
    _activeModule = null; // Permitir reintento
    console.error('[App] Module load error:', err);
  }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.module;
    navBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    _activeModule = null; // Permite re-montar al volver al mismo módulo
    loadModule(id);
  });
});

// ─── Worker Factory ────────────────────────────────────────────────────────
/**
 * Crea un Web Worker de procesamiento de imágenes.
 * SIN type:'module' — permite mayor compatibilidad de servidor
 * y el worker no necesita importar módulos externos.
 * @returns {Worker}
 */
export function createImageWorker() {
  // Intenta con URL dinámica (requiere ES module context)
  try {
    return new Worker(new URL('./workers/image-worker.js', import.meta.url));
  } catch {
    // Fallback para entornos sin soporte de import.meta.url en Worker
    return new Worker('js/workers/image-worker.js');
  }
}

/**
 * Envía una tarea al Worker y devuelve una Promise con el resultado.
 * El ArrayBuffer se TRANSFIERE (no copia) para ahorrar memoria.
 *
 * @param {Worker}  worker
 * @param {string}  type    'CROP_RESIZE' | 'COMPRESS' | 'RESIZE_ONLY'
 * @param {string}  taskId  ID único de la tarea
 * @param {Object}  data    Datos — data.arrayBuffer se transfiere
 * @returns {Promise<{blob: Blob, outputName: string}>}
 */
export function workerTask(worker, type, taskId, data) {
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const msg = e.data;
      if (msg.id !== taskId) return;
      cleanup();
      if (msg.type === 'RESULT') resolve({ blob: msg.blob, outputName: msg.outputName });
      else if (msg.type === 'ERROR') reject(new Error(msg.error));
    };
    const onErr = (e) => {
      cleanup();
      reject(new Error(`Worker error: ${e.message || 'desconocido'}`));
    };
    const cleanup = () => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
    };

    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);

    const transferList = (data.arrayBuffer instanceof ArrayBuffer) ? [data.arrayBuffer] : [];
    worker.postMessage({ type, id: taskId, data }, transferList);
  });
}

// ─── Helpers exportables ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
initIcons();
loadModule('store-manager');

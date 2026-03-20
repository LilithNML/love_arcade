/**
 * store-manager.js — Módulo I: Store Manager
 *
 * Wallpapers: archivo original intacto → renombrado {nombre}_{hash8}.ext
 * Thumbnails: recorte 16:9 → WebP 640×360 → {nombre}_{hash8}_thumb.webp
 * Salida: ZIP con /wallpapers y /thumbnails
 */

import { normalizeName, generateHash8, getExtension, formatBytes } from '../utils/naming.js';
import { ProcessingQueue } from '../utils/queue.js';
import { ZipBuilder } from '../utils/zip-builder.js';
import {
  openCropModal,
  showToast,
  showGlobalProgress,
  updateGlobalProgress,
  hideGlobalProgress,
  createImageWorker,
  workerTask,
  initIcons,
} from '../app.js';

// ─── State ─────────────────────────────────────────────────────────────────
/** @type {Array<{id:string, file:File, baseName:string, cropData:object|null, status:string}>} */
let items    = [];
let worker   = null;
let _mounted = null;  // Referencia al contenedor

// ─── Mount ─────────────────────────────────────────────────────────────────
export function mount(el) {
  _mounted = el;
  items    = [];
  worker   = createImageWorker();
  render();
}

// ─── Render ────────────────────────────────────────────────────────────────
function render() {
  _mounted.innerHTML = `
  <div class="mod-enter">

    <!-- Header -->
    <div class="mod-header">
      <div class="mod-header__row">
        <div class="mod-title-group">
          <div class="mod-icon"><i data-lucide="layers"></i></div>
          <div>
            <h2 class="mod-title">Store Manager</h2>
            <p class="mod-subtitle">Wallpapers originales intactos · Thumbnails 16:9 WebP · ZIP con carpetas separadas</p>
          </div>
        </div>
        <div class="mod-actions" id="sm-actions" style="display:none">
          <button class="btn btn-secondary btn-sm" id="sm-clear">
            <i data-lucide="trash-2"></i> Limpiar todo
          </button>
          <button class="btn btn-primary" id="sm-process" disabled>
            <i data-lucide="zap"></i> Procesar y Exportar ZIP
          </button>
        </div>
      </div>
      <div class="info-panel">
        <i data-lucide="info"></i>
        <span>
          Los <strong>wallpapers</strong> se copian sin modificar (extensión original, sin pérdida de calidad).<br>
          Los <strong>thumbnails</strong> se generan desde el recorte 16:9 → WebP 640×360px.<br>
          Si no defines recorte manual, se usa la imagen completa como base.
        </span>
      </div>
    </div>

    <!-- Stats (ocultas hasta que hay imágenes) -->
    <div class="stats-bar" id="sm-stats" style="display:none">
      <div class="stat">
        <div class="stat__val stat__val--neutral" id="sm-n-total">0</div>
        <div class="stat__lbl">Total</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat__val" id="sm-n-crop">0</div>
        <div class="stat__lbl">Con recorte</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat__val" id="sm-n-done">0</div>
        <div class="stat__lbl">Procesadas</div>
      </div>
      <div class="stats-progress" id="sm-progwrap" style="display:none">
        <div class="pbar-track"><div class="pbar-fill" id="sm-prog-fill" style="width:0%"></div></div>
        <span class="pbar-label" id="sm-prog-lbl">0%</span>
      </div>
    </div>

    <!-- Dropzone -->
    <div class="dropzone" id="sm-drop">
      <input type="file" id="sm-input" multiple accept="image/*"
             aria-label="Seleccionar imágenes wallpaper" />
      <div class="dropzone__icon"><i data-lucide="image-plus"></i></div>
      <p class="dropzone__title">Arrastra tus imágenes aquí</p>
      <p class="dropzone__sub">
        Cualquier formato de imagen · Sin límite de archivos<br>
        <strong>Haz clic para abrir el explorador de archivos</strong>
      </p>
    </div>

    <!-- Grid de imágenes -->
    <div class="img-grid" id="sm-grid"></div>

    <!-- Sección de descarga (post-procesamiento) -->
    <div class="download-section" id="sm-dl" style="display:none">
      <div class="flex flex-center gap-2" style="color:var(--c-success)">
        <i data-lucide="check-circle-2" style="width:20px;height:20px"></i>
        <span class="download-section__title">¡Exportación completa!</span>
      </div>
      <p class="download-section__meta" id="sm-dl-info"></p>
      <button class="btn btn-primary btn-lg" id="sm-redl">
        <i data-lucide="download"></i> Re-descargar ZIP
      </button>
    </div>

  </div>`;

  initIcons(_mounted);
  bindEvents();
}

// ─── Events ────────────────────────────────────────────────────────────────
function bindEvents() {
  const drop  = _mounted.querySelector('#sm-drop');
  const input = _mounted.querySelector('#sm-input');
  const grid  = _mounted.querySelector('#sm-grid');

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  input.addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });

  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);

  _mounted.querySelector('#sm-process').addEventListener('click', processAll);
  _mounted.querySelector('#sm-clear').addEventListener('click', clearAll);
}

function handleGridClick(e) {
  const cropBtn = e.target.closest('[data-action="crop"]');
  const delBtn  = e.target.closest('[data-action="delete"]');
  if (cropBtn) openCropForItem(cropBtn.closest('.img-card').dataset.id);
  if (delBtn)  removeItem(delBtn.closest('.img-card').dataset.id);
}

function handleGridInput(e) {
  if (!e.target.classList.contains('card-name-input')) return;
  const card = e.target.closest('.img-card');
  const id   = card.dataset.id;
  const item = items.find(i => i.id === id);
  if (!item) return;

  item.baseName = e.target.value.trim();
  const normalized = normalizeName(item.baseName || 'untitled');
  const ext  = (item.file.name.match(/\.([^.]+)$/) || ['', 'jpg'])[1].toLowerCase();

  // Actualizar preview en tiempo real
  const wallSpan  = card.querySelector('[data-type="wall"]');
  const thumbSpan = card.querySelector('[data-type="thumb"]');
  if (wallSpan)  wallSpan.innerHTML  = `${escHtml(normalized)}_<span class="fp-hash">●●●●●●●●</span>.${ext}`;
  if (thumbSpan) thumbSpan.innerHTML = `${escHtml(normalized)}_<span class="fp-hash">●●●●●●●●</span>_thumb.webp`;
}

// ─── Files ─────────────────────────────────────────────────────────────────
function addFiles(rawFiles) {
  const imgs = rawFiles.filter(f => f.type.startsWith('image/'));
  if (imgs.length === 0) {
    if (rawFiles.length > 0) showToast('Ningún archivo es una imagen válida.', 'warn');
    return;
  }
  imgs.forEach(file => {
    const id = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    items.push({ id, file, baseName: normalizeName(file.name), cropData: null, status: 'pending' });
    appendCard(id);
  });

  if (imgs.length < rawFiles.length) {
    showToast(`${rawFiles.length - imgs.length} archivo(s) omitido(s) (no son imágenes).`, 'warn');
  }
  showToast(`${imgs.length} imagen${imgs.length > 1 ? 'es' : ''} añadida${imgs.length > 1 ? 's' : ''}.`, 'success', 2500);
  refreshUI();
}

function appendCard(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const card = document.createElement('div');
  card.className = 'img-card';
  card.dataset.id = id;

  const url = URL.createObjectURL(item.file);
  const ext = (item.file.name.match(/\.([^.]+)$/) || ['', 'jpg'])[1].toLowerCase();

  card.innerHTML = `
    <div class="card-thumb card-thumb--16x9">
      <img src="${url}" alt="${escHtml(item.file.name)}"
           onload="URL.revokeObjectURL(this.src)" loading="lazy" />
      <div class="card-crop-border"></div>
      <div class="card-status"></div>
    </div>
    <div class="card-body">
      <span class="card-orig-name" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</span>
      <input class="card-name-input" type="text" value="${escHtml(item.baseName)}"
             placeholder="nombre_base" spellcheck="false"
             aria-label="Nombre base del archivo" />
      <div class="filename-preview" aria-live="polite">
        <div class="fp-row">
          <span class="fp-tag">Wall</span>
          <span class="fp-name" data-type="wall">${escHtml(item.baseName)}_<span class="fp-hash">●●●●●●●●</span>.${ext}</span>
        </div>
        <div class="fp-row">
          <span class="fp-tag">Thumb</span>
          <span class="fp-name" data-type="thumb">${escHtml(item.baseName)}_<span class="fp-hash">●●●●●●●●</span>_thumb.webp</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" style="flex:1" data-action="crop"
                aria-label="Ajustar recorte 16:9">
          <i data-lucide="crop"></i> Recorte 16:9
        </button>
        <button class="icon-btn" data-action="delete" aria-label="Eliminar imagen"
                style="color:var(--c-danger);border-color:rgba(255,95,95,0.2)">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="card-prog"><div class="card-prog-fill"></div></div>
    </div>`;

  _mounted.querySelector('#sm-grid').appendChild(card);
  initIcons(card);
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  _mounted.querySelector(`.img-card[data-id="${id}"]`)?.remove();
  refreshUI();
}

function clearAll() {
  items = [];
  _mounted.querySelector('#sm-grid').innerHTML = '';
  _mounted.querySelector('#sm-dl').style.display = 'none';
  refreshUI();
}

// ─── Crop ───────────────────────────────────────────────────────────────────
function openCropForItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  openCropModal(item.file, 16 / 9, cropData => {
    item.cropData = cropData;
    item.status   = 'cropped';
    const card = _mounted.querySelector(`.img-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('has-crop');
      card.querySelector('.card-status').innerHTML = '<span class="chip chip-success">16:9 ✓</span>';
    }
    refreshUI();
    showToast('Recorte 16:9 guardado.', 'success', 2000);
  });
}

// ─── Process ────────────────────────────────────────────────────────────────
async function processAll() {
  if (items.length === 0) { showToast('Carga al menos una imagen.', 'warn'); return; }

  const processBtn  = _mounted.querySelector('#sm-process');
  const clearBtn    = _mounted.querySelector('#sm-clear');
  const progWrap    = _mounted.querySelector('#sm-progwrap');

  processBtn.disabled = true;
  clearBtn.disabled   = true;
  progWrap.style.display = 'flex';
  showGlobalProgress('Generando thumbnails 16:9…');

  const queue   = new ProcessingQueue(3);
  const results = [];
  let   doneN   = 0;

  queue.onProgress = (done, total) => {
    const pct = Math.round((done / total) * 100);
    _mounted.querySelector('#sm-prog-fill').style.width = `${pct}%`;
    _mounted.querySelector('#sm-prog-lbl').textContent  = `${pct}%`;
    updateGlobalProgress(pct, `Procesando ${done}/${total}…`);
  };

  const tasks = items.map(item => async () => {
    const card = _mounted.querySelector(`.img-card[data-id="${item.id}"]`);
    try {
      const nameInput = card?.querySelector('.card-name-input');
      const rawName   = nameInput?.value?.trim() || item.baseName || 'untitled';
      const name      = normalizeName(rawName);
      const hash      = generateHash8();
      const ext       = getExtension(item.file.name) || 'jpg';

      // Wallpaper: original sin procesar
      const wallName = `${name}_${hash}.${ext}`;

      // Thumbnail: recorte 16:9 → WebP via worker
      const thumbName = `${name}_${hash}_thumb.webp`;
      let cropData    = item.cropData;
      if (!cropData) cropData = await getImageDimensions(item.file);

      const buf    = await item.file.arrayBuffer();
      const result = await workerTask(worker, 'CROP_RESIZE', `sm_${item.id}`, {
        arrayBuffer:  buf,
        mimeType:     item.file.type || 'image/jpeg',
        cropData,
        outputWidth:  640,
        outputHeight: 360,
        quality:      0.85,
        outputName:   thumbName,
      });

      results.push({ wallBlob: item.file, wallName, thumbBlob: result.blob, thumbName });

      if (card) {
        card.classList.add('is-done');
        card.classList.remove('has-crop');
        card.querySelector('.card-status').innerHTML = '<span class="chip chip-success">✓</span>';
        card.querySelector('.card-prog-fill').style.width = '100%';
      }
      item.status = 'done';
      doneN++;
      _mounted.querySelector('#sm-n-done').textContent = doneN;

    } catch (err) {
      console.error('[StoreManager]', item.file.name, err);
      item.status = 'error';
      if (card) {
        card.classList.add('has-error');
        card.querySelector('.card-status').innerHTML = '<span class="chip chip-danger">Error</span>';
      }
    }
  });

  await queue.addAll(tasks);

  // Generar ZIP
  try {
    updateGlobalProgress(95, 'Empaquetando ZIP…');
    const zip = new ZipBuilder();
    for (const r of results) {
      zip.file(`wallpapers/${r.wallName}`,  r.wallBlob);
      zip.file(`thumbnails/${r.thumbName}`, r.thumbBlob);
    }
    await zip.download(`store_manager_${new Date().toISOString().slice(0,10)}.zip`);

    const dlEl   = _mounted.querySelector('#sm-dl');
    const infoEl = _mounted.querySelector('#sm-dl-info');
    dlEl.style.display = 'flex';
    infoEl.textContent = `${results.length} wallpapers + ${results.length} thumbnails · ZIP descargado`;
    initIcons(dlEl);

    showToast(`✅ ${results.length} pares exportados en ZIP.`, 'success', 6000);

  } catch (err) {
    showToast(`Error al generar ZIP: ${err.message}`, 'error');
  }

  hideGlobalProgress();
  processBtn.disabled = false;
  clearBtn.disabled   = false;
  refreshUI();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
/** Obtiene dimensiones naturales de un archivo imagen como cropData. */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer: ${file.name}`)); };
    img.src = url;
  });
}

function refreshUI() {
  const total  = items.length;
  const hasAny = total > 0;

  _mounted.querySelector('#sm-n-total').textContent = total;
  _mounted.querySelector('#sm-n-crop').textContent  = items.filter(i => i.cropData).length;
  _mounted.querySelector('#sm-n-done').textContent  = items.filter(i => i.status === 'done').length;

  _mounted.querySelector('#sm-stats').style.display   = hasAny ? 'flex' : 'none';
  _mounted.querySelector('#sm-actions').style.display = hasAny ? 'flex' : 'none';

  const proc = _mounted.querySelector('#sm-process');
  if (proc) proc.disabled = !hasAny;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

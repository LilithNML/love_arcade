/**
 * puzzle-creator.js — Módulo II: Puzzle Asset Creator
 *
 * Input: +60 imágenes
 * Config: rango numérico (ej. 25–85)
 * Output:
 *   - nivel{n}.webp       → 1440×1440px, quality 0.9
 *   - nivel{n}_thumb.webp → 300×300px,   quality 0.3 (auto, bajo peso)
 * Nomenclatura: aleatoria dentro del rango, sin repetir
 */

import { shuffledRange, formatBytes } from '../utils/naming.js';
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
let items    = [];
let worker   = null;
let _mounted = null;

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

    <div class="mod-header">
      <div class="mod-header__row">
        <div class="mod-title-group">
          <div class="mod-icon"><i data-lucide="grid-3x3"></i></div>
          <div>
            <h2 class="mod-title">Puzzle Asset Creator</h2>
            <p class="mod-subtitle">Assets 1:1 a 1440×1440px · Auto-thumbnails · Nomenclatura aleatoria por rango</p>
          </div>
        </div>
        <div class="mod-actions" id="pc-actions" style="display:none">
          <button class="btn btn-secondary btn-sm" id="pc-clear">
            <i data-lucide="trash-2"></i> Limpiar
          </button>
          <button class="btn btn-primary" id="pc-process" disabled>
            <i data-lucide="zap"></i> Procesar y Exportar
          </button>
        </div>
      </div>
    </div>

    <!-- Dropzone -->
    <div class="dropzone" id="pc-drop">
      <input type="file" id="pc-input" multiple accept="image/*"
             aria-label="Seleccionar imágenes de puzzle" />
      <div class="dropzone__icon"><i data-lucide="puzzle"></i></div>
      <p class="dropzone__title">Carga tus imágenes de puzzle</p>
      <p class="dropzone__sub">
        Recomendado +60 imágenes · Cualquier formato<br>
        <strong>El recorte 1:1 es opcional — por defecto se centra automáticamente</strong>
      </p>
    </div>

    <!-- Config de rango (aparece tras cargar imágenes) -->
    <div id="pc-config" style="display:none">

      <div class="section-sep">Configuración del Rango de Niveles</div>

      <div style="display:flex; gap:var(--s4); align-items:flex-end; flex-wrap:wrap; margin-bottom:var(--s4)">
        <div class="form-group" style="max-width:160px">
          <label class="form-label" for="pc-range-from">Desde (nivel)</label>
          <input type="number" id="pc-range-from" class="form-input" value="1" min="0" max="9999" />
        </div>
        <div class="form-group" style="max-width:160px">
          <label class="form-label" for="pc-range-to">Hasta (nivel)</label>
          <input type="number" id="pc-range-to" class="form-input" value="60" min="0" max="9999" />
        </div>
        <div id="pc-range-status" style="padding-bottom:var(--s2); font-size:0.82rem; color:var(--tx-3)"></div>
      </div>

      <div class="info-panel">
        <i data-lucide="shuffle"></i>
        <span>
          Los nombres <strong>nivel{n}.webp</strong> y <strong>nivel{n}_thumb.webp</strong> se asignan
          <strong>aleatoriamente</strong> dentro del rango — sin orden predecible.<br>
          El rango debe tener al menos <strong id="pc-min-range">1</strong> números (= número de imágenes cargadas).
        </span>
      </div>

      <!-- Stats -->
      <div class="stats-bar mt-4">
        <div class="stat">
          <div class="stat__val stat__val--neutral" id="pc-n-total">0</div>
          <div class="stat__lbl">Imágenes</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <div class="stat__val" id="pc-n-crop">0</div>
          <div class="stat__lbl">Con recorte</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <div class="stat__val" id="pc-n-done">0</div>
          <div class="stat__lbl">Procesadas</div>
        </div>
        <div class="stats-progress" id="pc-progwrap" style="display:none">
          <div class="pbar-track"><div class="pbar-fill" id="pc-prog-fill" style="width:0%"></div></div>
          <span class="pbar-label" id="pc-prog-lbl">0%</span>
        </div>
      </div>
    </div>

    <!-- Grid de imágenes -->
    <div class="img-grid" id="pc-grid"></div>

    <!-- Descarga -->
    <div class="download-section" id="pc-dl" style="display:none">
      <div class="flex flex-center gap-2" style="color:var(--c-success)">
        <i data-lucide="check-circle-2" style="width:20px;height:20px"></i>
        <span class="download-section__title">¡Assets exportados!</span>
      </div>
      <p class="download-section__meta" id="pc-dl-info"></p>
      <button class="btn btn-primary btn-lg" id="pc-redl">
        <i data-lucide="download"></i> Re-descargar ZIP
      </button>
    </div>

  </div>`;

  initIcons(_mounted);
  bindEvents();
}

function bindEvents() {
  const drop  = _mounted.querySelector('#pc-drop');
  const input = _mounted.querySelector('#pc-input');
  const grid  = _mounted.querySelector('#pc-grid');

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  input.addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });

  grid.addEventListener('click', handleGridClick);

  _mounted.querySelector('#pc-process').addEventListener('click', processAll);
  _mounted.querySelector('#pc-clear').addEventListener('click', clearAll);

  // Actualizar status de rango al cambiar inputs
  ['pc-range-from', 'pc-range-to'].forEach(id => {
    _mounted.querySelector(`#${id}`).addEventListener('input', updateRangeStatus);
  });
}

function handleGridClick(e) {
  const cropBtn = e.target.closest('[data-action="crop"]');
  const delBtn  = e.target.closest('[data-action="delete"]');
  if (cropBtn) openCropForItem(cropBtn.closest('.img-card').dataset.id);
  if (delBtn)  removeItem(delBtn.closest('.img-card').dataset.id);
}

// ─── Files ─────────────────────────────────────────────────────────────────
function addFiles(rawFiles) {
  const imgs = rawFiles.filter(f => f.type.startsWith('image/'));
  if (imgs.length === 0) { showToast('Ningún archivo es una imagen válida.', 'warn'); return; }

  imgs.forEach(file => {
    const id = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    items.push({ id, file, cropData: null, status: 'pending' });
    appendCard(id);
  });

  // Actualizar rango "hasta" si es menor que el número de imágenes
  const toEl = _mounted.querySelector('#pc-range-to');
  if (toEl && parseInt(toEl.value) < items.length) toEl.value = items.length;

  showToast(`${imgs.length} imagen${imgs.length > 1 ? 'es' : ''} añadida${imgs.length > 1 ? 's' : ''}.`, 'success', 2500);
  refreshUI();
  updateRangeStatus();
}

function appendCard(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const card = document.createElement('div');
  card.className = 'img-card';
  card.dataset.id = id;

  const url = URL.createObjectURL(item.file);
  card.innerHTML = `
    <div class="card-thumb card-thumb--1x1">
      <img src="${url}" alt="${escHtml(item.file.name)}"
           onload="URL.revokeObjectURL(this.src)" loading="lazy" />
      <div class="card-crop-border"></div>
      <div class="card-status"></div>
    </div>
    <div class="card-body">
      <span class="card-orig-name" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</span>
      <div class="filename-preview">
        <div class="fp-row">
          <span class="fp-tag">Asset</span>
          <span class="fp-name fp-shuffle">nivel<span class="fp-hash">??</span>.webp <span class="fp-note">(aleatorio)</span></span>
        </div>
        <div class="fp-row">
          <span class="fp-tag">Thumb</span>
          <span class="fp-name fp-shuffle">nivel<span class="fp-hash">??</span>_thumb.webp</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" style="flex:1" data-action="crop"
                aria-label="Ajustar recorte 1:1">
          <i data-lucide="crop"></i> Recorte 1:1
        </button>
        <button class="icon-btn" data-action="delete" aria-label="Eliminar"
                style="color:var(--c-danger);border-color:rgba(255,95,95,0.2)">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="card-prog"><div class="card-prog-fill"></div></div>
    </div>`;

  _mounted.querySelector('#pc-grid').appendChild(card);
  initIcons(card);
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  _mounted.querySelector(`.img-card[data-id="${id}"]`)?.remove();
  refreshUI();
  updateRangeStatus();
}

function clearAll() {
  items = [];
  _mounted.querySelector('#pc-grid').innerHTML = '';
  _mounted.querySelector('#pc-dl').style.display = 'none';
  _mounted.querySelector('#pc-config').style.display = 'none';
  _mounted.querySelector('#pc-actions').style.display = 'none';
  refreshUI();
}

// ─── Crop ───────────────────────────────────────────────────────────────────
function openCropForItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  openCropModal(item.file, 1, cropData => {
    item.cropData = cropData;
    item.status   = 'cropped';
    const card = _mounted.querySelector(`.img-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('has-crop');
      card.querySelector('.card-status').innerHTML = '<span class="chip chip-success">1:1 ✓</span>';
    }
    refreshUI();
    showToast('Recorte 1:1 guardado.', 'success', 2000);
  });
}

// ─── Process ────────────────────────────────────────────────────────────────
async function processAll() {
  if (items.length === 0) { showToast('Carga al menos una imagen.', 'warn'); return; }

  const fromN = parseInt(_mounted.querySelector('#pc-range-from').value) || 1;
  const toN   = parseInt(_mounted.querySelector('#pc-range-to').value)   || items.length;

  if (fromN > toN) {
    showToast('El valor "Desde" debe ser menor que "Hasta".', 'error');
    return;
  }

  const rangeSize = toN - fromN + 1;
  if (rangeSize < items.length) {
    showToast(
      `El rango ${fromN}–${toN} tiene ${rangeSize} slots, pero hay ${items.length} imágenes. Amplía el rango.`,
      'error', 7000
    );
    return;
  }

  const levelNumbers = shuffledRange(fromN, toN).slice(0, items.length);

  const processBtn = _mounted.querySelector('#pc-process');
  const clearBtn   = _mounted.querySelector('#pc-clear');
  const progWrap   = _mounted.querySelector('#pc-progwrap');

  processBtn.disabled = true;
  clearBtn.disabled   = true;
  progWrap.style.display = 'flex';
  showGlobalProgress('Generando assets de puzzle…');

  const queue   = new ProcessingQueue(3);
  const results = [];
  let   doneN   = 0;

  queue.onProgress = (done, total) => {
    const pct = Math.round((done / total) * 100);
    // Cada imagen genera 2 tareas → normalizar a 50%
    const display = Math.round(pct / 2);
    _mounted.querySelector('#pc-prog-fill').style.width = `${pct}%`;
    _mounted.querySelector('#pc-prog-lbl').textContent  = `${pct}%`;
    updateGlobalProgress(pct, `Procesando ${done}/${total}…`);
  };

  const tasks = items.map((item, idx) => async () => {
    const card   = _mounted.querySelector(`.img-card[data-id="${item.id}"]`);
    const levelN = levelNumbers[idx];

    try {
      let cropData = item.cropData;
      if (!cropData) cropData = await getSquareCrop(item.file);

      // Leemos el buffer UNA VEZ y creamos dos copias para los dos transfers
      const buf1 = await item.file.arrayBuffer();
      const buf2 = buf1.slice(0); // copia para la segunda llamada

      const assetResult = await workerTask(worker, 'CROP_RESIZE', `pc_${item.id}_asset`, {
        arrayBuffer:  buf1,
        mimeType:     item.file.type || 'image/jpeg',
        cropData,
        outputWidth:  1440,
        outputHeight: 1440,
        quality:      0.9,
        outputName:   `nivel${levelN}.webp`,
      });

      const thumbResult = await workerTask(worker, 'CROP_RESIZE', `pc_${item.id}_thumb`, {
        arrayBuffer:  buf2,
        mimeType:     item.file.type || 'image/jpeg',
        cropData,
        outputWidth:  300,
        outputHeight: 300,
        quality:      0.3,
        outputName:   `nivel${levelN}_thumb.webp`,
      });

      results.push({
        assetBlob: assetResult.blob,
        assetName: `nivel${levelN}.webp`,
        thumbBlob: thumbResult.blob,
        thumbName: `nivel${levelN}_thumb.webp`,
      });

      if (card) {
        card.classList.add('is-done');
        card.classList.remove('has-crop');
        card.querySelector('.card-status').innerHTML =
          `<span class="chip chip-success">nivel${levelN}</span>`;
        card.querySelector('.card-prog-fill').style.width = '100%';
      }

      item.status = 'done';
      doneN++;
      _mounted.querySelector('#pc-n-done').textContent = doneN;

    } catch (err) {
      console.error('[PuzzleCreator]', item.file.name, err);
      item.status = 'error';
      if (card) {
        card.classList.add('has-error');
        card.querySelector('.card-status').innerHTML = '<span class="chip chip-danger">Error</span>';
      }
    }
  });

  await queue.addAll(tasks);

  // Generar ZIP — carpetas: niveles/ y thumbnails/
  try {
    updateGlobalProgress(95, 'Empaquetando ZIP…');
    const zip = new ZipBuilder();
    for (const r of results) {
      zip.file(`niveles/${r.assetName}`,     r.assetBlob);
      zip.file(`thumbnails/${r.thumbName}`,  r.thumbBlob);
    }
    await zip.download(`puzzle_assets_${new Date().toISOString().slice(0,10)}.zip`);

    const dlEl   = _mounted.querySelector('#pc-dl');
    const infoEl = _mounted.querySelector('#pc-dl-info');
    dlEl.style.display = 'flex';
    infoEl.textContent = `ZIP con /niveles/ (1440px) y /thumbnails/ (300px) · ${results.length} pares`;
    initIcons(dlEl);

    showToast(`✅ ${results.length} pares de puzzle exportados.`, 'success', 6000);

  } catch (err) {
    showToast(`Error al generar ZIP: ${err.message}`, 'error');
  }

  hideGlobalProgress();
  processBtn.disabled = false;
  clearBtn.disabled   = false;
  refreshUI();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getSquareCrop(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      resolve({
        x: Math.round((img.naturalWidth  - side) / 2),
        y: Math.round((img.naturalHeight - side) / 2),
        width:  side,
        height: side,
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Error leyendo: ${file.name}`)); };
    img.src = url;
  });
}

function refreshUI() {
  const total  = items.length;
  const hasAny = total > 0;

  _mounted.querySelector('#pc-n-total').textContent = total;
  _mounted.querySelector('#pc-n-crop').textContent  = items.filter(i => i.cropData).length;

  _mounted.querySelector('#pc-config').style.display  = hasAny ? 'block' : 'none';
  _mounted.querySelector('#pc-actions').style.display = hasAny ? 'flex'  : 'none';

  const proc = _mounted.querySelector('#pc-process');
  if (proc) proc.disabled = !hasAny;

  const minRangeEl = _mounted.querySelector('#pc-min-range');
  if (minRangeEl) minRangeEl.textContent = total;
}

function updateRangeStatus() {
  const fromN = parseInt(_mounted.querySelector('#pc-range-from')?.value) || 0;
  const toN   = parseInt(_mounted.querySelector('#pc-range-to')?.value)   || 0;
  const size  = toN - fromN + 1;
  const el    = _mounted.querySelector('#pc-range-status');
  if (!el) return;

  if (fromN > toN) {
    el.textContent = '⚠ "Desde" debe ser menor que "Hasta"';
    el.style.color = 'var(--c-warn)';
  } else if (size < items.length) {
    el.textContent = `⚠ Rango insuficiente: ${size} slots < ${items.length} imágenes`;
    el.style.color = 'var(--c-danger)';
  } else {
    el.textContent = `✓ ${size} slots disponibles para ${items.length} imágenes`;
    el.style.color = 'var(--c-success)';
  }
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

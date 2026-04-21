/**
 * smart-compressor.js — Módulo III: Smart Compressor
 *
 * Input:  Imágenes (preferentemente .webp)
 * Output: Re-codificadas a WebP quality 0.3 → ~70% menos peso
 *         Nombre: {nombre_original}_thumb.webp
 * Salida: ZIP
 */

import { normalizeName, formatBytes } from '../utils/naming.js';
import { ProcessingQueue } from '../utils/queue.js';
import { ZipBuilder } from '../utils/zip-builder.js';
import {
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
let _results = [];

// ─── Mount ─────────────────────────────────────────────────────────────────
export function mount(el) {
  _mounted = el;
  items    = [];
  _results = [];
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
          <div class="mod-icon"><i data-lucide="minimize-2"></i></div>
          <div>
            <h2 class="mod-title">Smart Compressor</h2>
            <p class="mod-subtitle">Reducción de peso ~70% · WebP quality 0.3 · Sufijo _thumb al nombre</p>
          </div>
        </div>
        <div class="mod-actions" id="sc-actions" style="display:none">
          <button class="btn btn-secondary btn-sm" id="sc-clear">
            <i data-lucide="trash-2"></i> Limpiar
          </button>
          <button class="btn btn-primary" id="sc-process" disabled>
            <i data-lucide="minimize-2"></i> Comprimir Todo
          </button>
        </div>
      </div>
      <div class="info-panel">
        <i data-lucide="info"></i>
        <span>
          Acepta cualquier formato de imagen (no solo .webp).<br>
          La compresión usa <strong>calidad 0.3</strong>, apuntando a un ahorro de ~70% sobre el original.<br>
          Los archivos de salida se nombran <strong>{nombre}_thumb.webp</strong>.
        </span>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-bar" id="sc-stats" style="display:none">
      <div class="stat">
        <div class="stat__val stat__val--neutral" id="sc-n-files">0</div>
        <div class="stat__lbl">Archivos</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat__val stat__val--neutral" id="sc-sz-orig">—</div>
        <div class="stat__lbl">Peso original</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat__val" id="sc-sz-comp">—</div>
        <div class="stat__lbl">Peso comprimido</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat__val" id="sc-saving">—</div>
        <div class="stat__lbl">Ahorro total</div>
      </div>
      <div class="stats-progress" id="sc-progwrap" style="display:none">
        <div class="pbar-track"><div class="pbar-fill" id="sc-prog-fill" style="width:0%"></div></div>
        <span class="pbar-label" id="sc-prog-lbl">0%</span>
      </div>
    </div>

    <!-- Dropzone -->
    <div class="dropzone" id="sc-drop">
      <input type="file" id="sc-input" multiple accept="image/*"
             aria-label="Seleccionar imágenes para comprimir" />
      <div class="dropzone__icon"><i data-lucide="file-image"></i></div>
      <p class="dropzone__title">Arrastra imágenes a comprimir</p>
      <p class="dropzone__sub">
        Preferentemente <strong>.webp</strong> · También acepta JPG, PNG, AVIF<br>
        <strong>Sin límite de archivos</strong>
      </p>
    </div>

    <!-- Lista de archivos -->
    <div class="compress-list" id="sc-list"></div>

    <!-- Descarga -->
    <div class="download-section" id="sc-dl" style="display:none">
      <div class="flex flex-center gap-2" style="color:var(--c-success)">
        <i data-lucide="check-circle-2" style="width:20px;height:20px"></i>
        <span class="download-section__title">¡Compresión completa!</span>
      </div>
      <p class="download-section__meta" id="sc-dl-info"></p>
      <button class="btn btn-primary btn-lg" id="sc-redl">
        <i data-lucide="download"></i> Re-descargar ZIP
      </button>
    </div>

  </div>`;

  initIcons(_mounted);
  bindEvents();
}

function bindEvents() {
  const drop  = _mounted.querySelector('#sc-drop');
  const input = _mounted.querySelector('#sc-input');

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  input.addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });

  _mounted.querySelector('#sc-process').addEventListener('click', processAll);
  _mounted.querySelector('#sc-clear').addEventListener('click', clearAll);
}

// ─── Files ─────────────────────────────────────────────────────────────────
function addFiles(rawFiles) {
  const imgs = rawFiles.filter(f => f.type.startsWith('image/'));
  if (imgs.length === 0) { showToast('Ningún archivo es una imagen.', 'warn'); return; }

  // Deduplicar por nombre+tamaño
  const seen = new Set(items.map(i => `${i.file.name}::${i.file.size}`));
  const uniq = imgs.filter(f => !seen.has(`${f.name}::${f.size}`));

  if (uniq.length === 0) { showToast('Todos los archivos ya están en la lista.', 'warn'); return; }

  uniq.forEach(file => {
    const id = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    items.push({ id, file, status: 'pending', compressedSize: null });
    appendRow(id);
  });

  if (uniq.length < imgs.length) showToast(`${imgs.length - uniq.length} duplicado(s) omitido(s).`, 'warn');
  showToast(`${uniq.length} archivo${uniq.length > 1 ? 's' : ''} añadido${uniq.length > 1 ? 's' : ''}.`, 'success', 2500);
  refreshUI();
}

function appendRow(id) {
  const item    = items.find(i => i.id === id);
  if (!item) return;
  const outName = `${normalizeName(item.file.name)}_thumb.webp`;
  const list    = _mounted.querySelector('#sc-list');

  const row = document.createElement('div');
  row.className   = 'compress-row';
  row.dataset.id  = id;
  row.innerHTML = `
    <div class="compress-row__name">
      <div class="compress-row__filename" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</div>
      <div class="compress-row__outname">→ <span>${escHtml(outName)}</span></div>
    </div>
    <div class="size-col">${formatBytes(item.file.size)}</div>
    <div class="size-col after" id="sc-comp-${id}">—</div>
    <div class="saving-col" id="sc-save-${id}">
      <span class="chip chip-neutral">Pendiente</span>
    </div>`;

  list.appendChild(row);
}

function clearAll() {
  items    = [];
  _results = [];
  _mounted.querySelector('#sc-list').innerHTML = '';
  _mounted.querySelector('#sc-dl').style.display    = 'none';
  _mounted.querySelector('#sc-stats').style.display = 'none';
  _mounted.querySelector('#sc-actions').style.display = 'none';
  refreshUI();
}

// ─── Process ────────────────────────────────────────────────────────────────
async function processAll() {
  if (items.length === 0) { showToast('Carga archivos primero.', 'warn'); return; }

  const processBtn = _mounted.querySelector('#sc-process');
  const clearBtn   = _mounted.querySelector('#sc-clear');
  const progWrap   = _mounted.querySelector('#sc-progwrap');

  processBtn.disabled = true;
  clearBtn.disabled   = true;
  progWrap.style.display = 'flex';
  showGlobalProgress('Comprimiendo imágenes…');

  _results = [];
  const queue = new ProcessingQueue(3);

  queue.onProgress = (done, total) => {
    const pct = Math.round((done / total) * 100);
    _mounted.querySelector('#sc-prog-fill').style.width = `${pct}%`;
    _mounted.querySelector('#sc-prog-lbl').textContent  = `${pct}%`;
    updateGlobalProgress(pct, `Comprimiendo ${done}/${total}…`);
  };

  const tasks = items.map(item => async () => {
    const row     = _mounted.querySelector(`.compress-row[data-id="${item.id}"]`);
    const outName = `${normalizeName(item.file.name)}_thumb.webp`;

    try {
      const buf    = await item.file.arrayBuffer();
      const result = await workerTask(worker, 'COMPRESS', `sc_${item.id}`, {
        arrayBuffer: buf,
        mimeType:    item.file.type || 'image/webp',
        quality:     0.3,
        outputName:  outName,
      });

      item.compressedSize = result.blob.size;
      item.status         = 'done';
      _results.push({ blob: result.blob, name: outName });

      const saved    = item.file.size - result.blob.size;
      const savedPct = Math.round((saved / item.file.size) * 100);
      const isGood   = savedPct >= 40;

      if (row) {
        row.classList.add('is-done');
        const compEl = _mounted.querySelector(`#sc-comp-${item.id}`);
        const saveEl = _mounted.querySelector(`#sc-save-${item.id}`);
        if (compEl) compEl.textContent = formatBytes(result.blob.size);
        if (saveEl) saveEl.innerHTML   =
          `<span class="chip ${isGood ? 'chip-success' : 'chip-warn'}">-${savedPct}%</span>`;
      }

    } catch (err) {
      console.error('[SmartCompressor]', item.file.name, err);
      item.status = 'error';
      if (row) {
        row.classList.add('is-error');
        const saveEl = _mounted.querySelector(`#sc-save-${item.id}`);
        if (saveEl) saveEl.innerHTML = '<span class="chip chip-danger">Error</span>';
      }
    }
  });

  await queue.addAll(tasks);

  refreshUI(); // Actualiza totales con datos comprimidos

  // Generar ZIP
  try {
    updateGlobalProgress(95, 'Empaquetando ZIP…');
    const zip = new ZipBuilder();
    for (const r of _results) zip.file(r.name, r.blob);
    await zip.download(`compressed_${new Date().toISOString().slice(0,10)}.zip`);

    const totalOrig = items.reduce((s, i) => s + i.file.size, 0);
    const totalComp = _results.reduce((s, r) => s + r.blob.size, 0);
    const globalSave = Math.round(((totalOrig - totalComp) / totalOrig) * 100);

    const dlEl   = _mounted.querySelector('#sc-dl');
    const infoEl = _mounted.querySelector('#sc-dl-info');
    dlEl.style.display = 'flex';
    infoEl.textContent = `${_results.length} archivos · ${formatBytes(totalOrig)} → ${formatBytes(totalComp)} · Ahorro: ~${globalSave}%`;
    initIcons(dlEl);

    showToast(`✅ Ahorro global: ~${globalSave}% (${formatBytes(totalOrig - totalComp)})`, 'success', 7000);

  } catch (err) {
    showToast(`Error al generar ZIP: ${err.message}`, 'error');
  }

  hideGlobalProgress();
  processBtn.disabled = false;
  clearBtn.disabled   = false;
}

// ─── Stats ──────────────────────────────────────────────────────────────────
function refreshUI() {
  const total    = items.length;
  const hasAny   = total > 0;
  const origSize = items.reduce((s, i) => s + i.file.size, 0);
  const compSize = items.filter(i => i.compressedSize).reduce((s, i) => s + i.compressedSize, 0);

  _mounted.querySelector('#sc-n-files').textContent = total;
  _mounted.querySelector('#sc-sz-orig').textContent = total > 0 ? formatBytes(origSize) : '—';

  if (compSize > 0) {
    const saved = Math.round(((origSize - compSize) / origSize) * 100);
    _mounted.querySelector('#sc-sz-comp').textContent = formatBytes(compSize);
    _mounted.querySelector('#sc-saving').textContent  = `~${saved}%`;
  } else {
    _mounted.querySelector('#sc-sz-comp').textContent = '—';
    _mounted.querySelector('#sc-saving').textContent  = '—';
  }

  _mounted.querySelector('#sc-stats').style.display   = hasAny ? 'flex' : 'none';
  _mounted.querySelector('#sc-actions').style.display = hasAny ? 'flex' : 'none';

  const proc = _mounted.querySelector('#sc-process');
  if (proc) proc.disabled = !hasAny;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

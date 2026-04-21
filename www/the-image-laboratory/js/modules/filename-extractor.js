/**
 * filename-extractor.js — Módulo IV: Filename Extractor
 *
 * Extrae nombres de archivos (sin leer su contenido).
 * Opciones: copiar originales, copiar normalizados, descargar .txt.
 */

import { normalizeName, formatBytes } from '../utils/naming.js';
import { showToast, initIcons } from '../app.js';

// ─── State ─────────────────────────────────────────────────────────────────
let files    = [];
let showNorm = false;
let _mounted = null;

// ─── Mount ─────────────────────────────────────────────────────────────────
export function mount(el) {
  _mounted = el;
  files    = [];
  showNorm = false;
  render();
}

// ─── Render ────────────────────────────────────────────────────────────────
function render() {
  _mounted.innerHTML = `
  <div class="mod-enter">

    <div class="mod-header">
      <div class="mod-header__row">
        <div class="mod-title-group">
          <div class="mod-icon"><i data-lucide="file-text"></i></div>
          <div>
            <h2 class="mod-title">Filename Extractor</h2>
            <p class="mod-subtitle">Extrae y copia nombres de archivos · Sin leer el contenido de los archivos</p>
          </div>
        </div>
        <div class="mod-actions" id="fe-actions" style="display:none">
          <button class="btn btn-secondary btn-sm" id="fe-clear">
            <i data-lucide="trash-2"></i> Limpiar
          </button>
        </div>
      </div>
      <div class="info-panel">
        <i data-lucide="shield-check"></i>
        <span>
          <strong>Privacidad total:</strong> los archivos NO se leen, abren ni procesan.
          Solo se accede a los metadatos: nombre y tamaño.
          Compatible con cualquier tipo de archivo.
        </span>
      </div>
    </div>

    <!-- Dropzone -->
    <div class="dropzone" id="fe-drop">
      <input type="file" id="fe-input" multiple aria-label="Seleccionar archivos para extraer nombres" />
      <div class="dropzone__icon"><i data-lucide="files"></i></div>
      <p class="dropzone__title">Arrastra cualquier archivo aquí</p>
      <p class="dropzone__sub">
        Cualquier tipo y cantidad · Solo se leen los nombres<br>
        <strong>Haz clic para abrir el explorador</strong>
      </p>
    </div>

    <!-- Panel de resultados -->
    <div id="fe-panel" style="display:none; margin-top:var(--s6)">

      <!-- Stats -->
      <div class="stats-bar" style="margin-bottom:var(--s4)">
        <div class="stat">
          <div class="stat__val stat__val--neutral" id="fe-n-files">0</div>
          <div class="stat__lbl">Archivos</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <div class="stat__val stat__val--neutral" id="fe-total-size">—</div>
          <div class="stat__lbl">Tamaño total</div>
        </div>
      </div>

      <!-- Acciones -->
      <div style="display:flex; gap:var(--s3); flex-wrap:wrap; align-items:center; margin-bottom:var(--s4)">
        <button class="btn btn-primary" id="fe-copy">
          <i data-lucide="clipboard-copy"></i> Copiar nombres
        </button>
        <button class="btn btn-secondary" id="fe-copy-norm">
          <i data-lucide="wand-2"></i> Copiar normalizados
        </button>
        <button class="btn btn-secondary" id="fe-dl-txt">
          <i data-lucide="download"></i> Descargar .txt
        </button>
        <label class="flex items-center gap-2"
               style="cursor:pointer; font-size:0.84rem; color:var(--tx-2); padding:var(--s2); margin-left:auto">
          <input type="checkbox" id="fe-norm-toggle"
                 style="accent-color:var(--accent); width:16px; height:16px; cursor:pointer" />
          Ver nombres normalizados
        </label>
      </div>

      <!-- Lista -->
      <div class="file-list-box" id="fe-list"></div>

      <p class="text-sm text-muted mt-3">
        Los archivos no se leen ni se suben a ningún servidor.
        Solo se procesa información de metadatos.
      </p>
    </div>

  </div>`;

  initIcons(_mounted);
  bindEvents();
}

function bindEvents() {
  const drop  = _mounted.querySelector('#fe-drop');
  const input = _mounted.querySelector('#fe-input');

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  input.addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });

  _mounted.querySelector('#fe-copy').addEventListener('click', () => copyNames(false));
  _mounted.querySelector('#fe-copy-norm').addEventListener('click', () => copyNames(true));
  _mounted.querySelector('#fe-dl-txt').addEventListener('click', downloadTxt);
  _mounted.querySelector('#fe-clear').addEventListener('click', clearAll);

  _mounted.querySelector('#fe-norm-toggle').addEventListener('change', e => {
    showNorm = e.target.checked;
    renderList();
  });
}

// ─── Files ─────────────────────────────────────────────────────────────────
function addFiles(newFiles) {
  if (newFiles.length === 0) return;
  const key   = f => `${f.name}::${f.size}`;
  const exist = new Set(files.map(key));
  const uniq  = newFiles.filter(f => !exist.has(key(f)));

  files.push(...uniq);

  if (uniq.length < newFiles.length) {
    showToast(`${newFiles.length - uniq.length} duplicado(s) omitido(s).`, 'warn', 2500);
  }
  showToast(`${uniq.length} nombre${uniq.length > 1 ? 's' : ''} extraído${uniq.length > 1 ? 's' : ''}.`, 'success', 2000);

  refreshUI();
  renderList();
}

function clearAll() {
  files = [];
  _mounted.querySelector('#fe-panel').style.display   = 'none';
  _mounted.querySelector('#fe-actions').style.display = 'none';
  _mounted.querySelector('#fe-list').innerHTML = '';
}

// ─── List ───────────────────────────────────────────────────────────────────
function renderList() {
  const list = _mounted.querySelector('#fe-list');
  if (files.length === 0) { list.innerHTML = ''; return; }

  const frag = document.createDocumentFragment();
  files.forEach((f, i) => {
    const displayName = showNorm ? normalizeName(f.name) : f.name;
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.innerHTML = `
      <span class="file-num">${i + 1}</span>
      <span class="file-name">${escHtml(displayName)}</span>
      <span class="file-size">${formatBytes(f.size)}</span>`;
    frag.appendChild(item);
  });

  list.innerHTML = '';
  list.appendChild(frag);
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function copyNames(normalized) {
  if (files.length === 0) { showToast('No hay archivos cargados.', 'warn'); return; }
  const text = files.map(f => normalized ? normalizeName(f.name) : f.name).join('\n');
  await toClipboard(
    text,
    `${files.length} nombre${files.length > 1 ? 's' : ''} ${normalized ? 'normalizado' : 'original'}${files.length > 1 ? 's' : ''} copiado${files.length > 1 ? 's' : ''}.`
  );
}

async function toClipboard(text, msg) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = Object.assign(document.createElement('textarea'), {
        value: text,
        style: 'position:fixed;opacity:0;pointer-events:none',
      });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(msg, 'success');
  } catch {
    showToast('No se pudo acceder al portapapeles.', 'error');
  }
}

function downloadTxt() {
  if (files.length === 0) { showToast('No hay archivos cargados.', 'warn'); return; }
  const content = files.map((f, i) => `${String(i + 1).padStart(4, '0')} | ${f.name}`).join('\n');
  const blob    = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement('a'), {
    href:     url,
    download: `filenames_${new Date().toISOString().slice(0,10)}.txt`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('Archivo .txt descargado.', 'success');
}

// ─── Stats ──────────────────────────────────────────────────────────────────
function refreshUI() {
  const total     = files.length;
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  _mounted.querySelector('#fe-n-files').textContent   = total;
  _mounted.querySelector('#fe-total-size').textContent = formatBytes(totalSize);

  _mounted.querySelector('#fe-panel').style.display   = total > 0 ? 'block' : 'none';
  _mounted.querySelector('#fe-actions').style.display = total > 0 ? 'flex'  : 'none';
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

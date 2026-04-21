/**
 * naming.js — Lógica Global de Nomenclatura
 *
 * Pipeline de normalización:
 *   1. Quitar extensión
 *   2. Eliminar acentos (NFD + strip diacríticos)
 *   3. Lowercase
 *   4. Espacios → guión bajo
 *   5. Eliminar chars no alfanuméricos (excepto _ y -)
 *   6. Colapsar separadores consecutivos
 *   7. Trim de separadores al inicio/final
 *   8. Fallback a "untitled"
 */

/**
 * Normaliza un nombre (con o sin extensión).
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return 'untitled';
  return (
    name
      .replace(/\.[^/.]+$/, '')          // 1. quitar extensión
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // 2. eliminar diacríticos
      .toLowerCase()                     // 3. lowercase
      .replace(/\s+/g, '_')             // 4. espacios → _
      .replace(/[^a-z0-9_\-]/g, '')    // 5. eliminar especiales
      .replace(/[_\-]{2,}/g, '_')       // 6. colapsar separadores
      .replace(/^[_\-]+|[_\-]+$/g, '') // 7. trim separadores
    || 'untitled'                        // 8. fallback
  );
}

/**
 * Extrae la extensión de un nombre de archivo (sin punto, minúsculas).
 * @param {string} filename
 * @returns {string}
 */
export function getExtension(filename) {
  const m = String(filename).match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Genera un hash alfanumérico aleatorio de 8 caracteres.
 * Usa crypto.getRandomValues cuando está disponible.
 * @returns {string}
 */
export function generateHash8() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let h = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    for (const b of arr) h += chars[b % chars.length];
  } else {
    for (let i = 0; i < 8; i++) h += chars[Math.floor(Math.random() * chars.length)];
  }
  return h;
}

/**
 * Formatea bytes en una cadena legible.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Genera un array de enteros [start, end] barajado aleatoriamente (Fisher-Yates).
 * Usado por Puzzle Creator para asignar niveles sin repetir.
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
export function shuffledRange(start, end) {
  if (start > end) [start, end] = [end, start];
  const arr = Array.from({ length: end - start + 1 }, (_, i) => i + start);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

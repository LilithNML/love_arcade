/**
 * zip-builder.js — Abstracción sobre JSZip para generar y descargar ZIPs.
 *
 * FIXES:
 * - file() convierte File → ArrayBuffer antes de pasarlo a JSZip.
 *   JSZip v3 acepta Blob/File pero algunos navegadores fallan al leerlos
 *   de forma lazy durante generateAsync(). Convertir a ArrayBuffer evita
 *   el problema al garantizar que los datos están en memoria al generar.
 * - download() no elimina el <a> del DOM inmediatamente; espera 100ms
 *   para que el navegador procese el evento click antes de removerlo.
 */
export class ZipBuilder {
  constructor() {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip no está disponible. Verifica que el CDN cargó correctamente.');
    }
    this._zip      = new JSZip();
    this._promises = []; // Promesas de lectura de File/Blob → ArrayBuffer
  }

  /**
   * Añade un archivo al ZIP.
   * Si data es un File o Blob, lo convierte a ArrayBuffer de forma asíncrona
   * para garantizar compatibilidad total con JSZip durante generateAsync().
   *
   * @param {string}                    path  Ruta relativa en el ZIP
   * @param {Blob|File|ArrayBuffer|Uint8Array} data
   * @returns {this}
   */
  file(path, data) {
    if (data instanceof File || data instanceof Blob) {
      // Guardar la promesa; se resuelven todas antes de generateAsync
      const p = data.arrayBuffer().then(buf => {
        this._zip.file(path, buf);
      });
      this._promises.push(p);
    } else {
      this._zip.file(path, data);
    }
    return this;
  }

  /**
   * Genera el ZIP como Blob.
   * Espera a que todos los File/Blob pendientes sean leídos primero.
   *
   * @param {(meta: {percent: number}) => void} [onProgress]
   * @returns {Promise<Blob>}
   */
  async toBlob(onProgress) {
    // Esperar todas las conversiones File→ArrayBuffer pendientes
    if (this._promises.length > 0) {
      await Promise.all(this._promises);
      this._promises = [];
    }
    return this._zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } },
      onProgress ?? undefined,
    );
  }

  /**
   * Genera el ZIP y dispara la descarga en el navegador.
   *
   * FIX: El <a> se mantiene en el DOM durante 500ms después del click
   * para que el navegador pueda procesar el evento antes de que se elimine.
   * URL.revokeObjectURL se aplaza 60s para asegurar que la descarga completa.
   *
   * @param {string}   filename
   * @param {Function} [onProgress]
   */
  async download(filename = 'export.zip', onProgress) {
    const blob = await this.toBlob(onProgress);
    const url  = URL.createObjectURL(blob);

    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);

    // Disparar la descarga
    a.click();

    // Esperar antes de limpiar (el navegador necesita tiempo para iniciar la descarga)
    setTimeout(() => {
      document.body.removeChild(a);
    }, 500);

    // Revocar la URL después de suficiente tiempo para que la descarga complete
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  }

  /** Número de archivos en el ZIP (sin contar carpetas). */
  get fileCount() {
    return Object.values(this._zip.files).filter(f => !f.dir).length;
  }
}

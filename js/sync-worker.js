/**
 * sync-worker.js — Love Arcade v9.6
 * Web Worker responsable de la codificación/decodificación Base64
 * y del cálculo de checksums SHA-256 para la sincronización de partidas.
 * Ejecuta operaciones pesadas en un hilo separado para no bloquear la UI.
 *
 * CAMBIOS v9.6 (sincronización de versión + modernización de encoding):
 *  - Versión actualizada de v7.5 a v9.6 para coincidir con el proyecto.
 *  - exportStore(): reemplaza btoa(unescape(encodeURIComponent())) —
 *    funciones deprecadas en todos los motores modernos— por TextEncoder
 *    + Array.from() + String.fromCharCode(), idéntico al fallback de app.js.
 *  - importStore(): reemplaza decodeURIComponent(escape(atob())) por
 *    TextDecoder sobre Uint8Array, sin funciones deprecadas.
 */

/**
 * Calcula el hash SHA-256 de un texto dado.
 * @param {string} text
 * @returns {Promise<string>} Hash hexadecimal de 64 caracteres.
 */
async function computeHash(text) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Codifica el store a Base64 con checksum de integridad.
 * @param {object} store Estado completo del usuario.
 * @param {string} salt  Salt secreto para el hash.
 * @returns {Promise<string>} Código exportable.
 */
async function exportStore(store, salt) {
    const json = JSON.stringify(store);
    const checksum = await computeHash(json + salt);
    const payload = JSON.stringify({ data: store, checksum });
    // TextEncoder → bytes → String.fromCharCode → btoa:
    // reemplaza el patrón obsoleto btoa(unescape(encodeURIComponent()))
    // que usa funciones deprecadas en motores modernos.
    const bytes = new TextEncoder().encode(payload);
    const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
    return btoa(binary);
}

/**
 * Decodifica un código de exportación y valida su integridad.
 * @param {string} code Código importado por el usuario.
 * @param {string} salt Salt secreto para verificar el hash.
 * @returns {Promise<{data: object, valid: boolean}>}
 */
async function importStore(code, salt) {
    // TextDecoder sobre Uint8Array reemplaza decodeURIComponent(escape(atob()))
    // que usa funciones deprecadas en motores modernos.
    const raw = atob(code.trim());
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);
    
    // Compatibilidad con partidas antiguas (v7.2 y anteriores)
    // que no incluían campo checksum.
    if (!payload.checksum || !payload.data) {
        // Formato legado: el JSON era directamente el store
        const legacyStore = payload;
        if (typeof legacyStore.coins !== 'number') {
            throw new Error('Formato inválido');
        }
        return { data: legacyStore, valid: true, legacy: true };
    }
    
    const expected = await computeHash(JSON.stringify(payload.data) + salt);
    return {
        data: payload.data,
        valid: payload.checksum === expected,
        legacy: false
    };
}

// ── Receptor de mensajes ──────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
    const { id, action, ...data } = e.data;
    
    try {
        if (action === 'export') {
            const result = await exportStore(data.store, data.salt);
            self.postMessage({ id, result });
            
        } else if (action === 'import') {
            const result = await importStore(data.code, data.salt);
            self.postMessage({ id, result });
            
        } else {
            self.postMessage({ id, error: `Acción desconocida: ${action}` });
        }
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
});
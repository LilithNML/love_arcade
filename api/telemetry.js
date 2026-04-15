/**
 * api/telemetry.js
 * Alias funcional de /api/report.
 *
 * Se mantiene para esquivar bloqueos de extensiones que filtran rutas
 * con nombres típicos de telemetría (por ejemplo, "report").
 * Ambos endpoints reutilizan exactamente el mismo handler serverless.
 */

export { config } from './report.js';
export { default } from './report.js';

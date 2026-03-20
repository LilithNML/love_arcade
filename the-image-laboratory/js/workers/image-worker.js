/**
 * image-worker.js — Web Worker de Procesamiento de Imágenes
 *
 * Usa OffscreenCanvas + createImageBitmap para procesamiento off-thread.
 * NO usa import/export (compatibilidad con Worker sin type:'module').
 *
 * Mensajes recibidos:
 *   { type: 'CROP_RESIZE', id, data: { arrayBuffer, mimeType, cropData, outputWidth, outputHeight, quality, outputName } }
 *   { type: 'COMPRESS',    id, data: { arrayBuffer, mimeType, quality, outputName } }
 *   { type: 'RESIZE_ONLY', id, data: { arrayBuffer, mimeType, outputWidth, outputHeight, quality, outputName } }
 *
 * Mensajes enviados:
 *   { type: 'RESULT', id, blob, outputName }
 *   { type: 'ERROR',  id, error }
 */

/* global createImageBitmap, OffscreenCanvas */

self.onmessage = async function (e) {
  const { type, id, data } = e.data;
  try {
    let result;
    switch (type) {
      case 'CROP_RESIZE': result = await doCropResize(data); break;
      case 'COMPRESS':    result = await doCompress(data);   break;
      case 'RESIZE_ONLY': result = await doResizeOnly(data); break;
      default: throw new Error(`Tipo de operación desconocido: "${type}"`);
    }
    self.postMessage({ type: 'RESULT', id, blob: result.blob, outputName: result.name });
  } catch (err) {
    self.postMessage({ type: 'ERROR', id, error: err.message ?? String(err) });
  }
};

/**
 * CROP_RESIZE — Recorta la región cropData y escala al tamaño de salida.
 */
async function doCropResize({ arrayBuffer, mimeType, cropData, outputWidth, outputHeight, quality, outputName }) {
  const srcBlob = new Blob([arrayBuffer], { type: mimeType });
  const bmp     = await createImageBitmap(srcBlob);

  // Garantizar que las coordenadas de recorte estén dentro de la imagen
  const sx = Math.max(0, Math.round(cropData.x));
  const sy = Math.max(0, Math.round(cropData.y));
  const sw = Math.min(Math.round(cropData.width),  bmp.width  - sx);
  const sh = Math.min(Math.round(cropData.height), bmp.height - sy);

  if (sw <= 0 || sh <= 0) throw new Error('Dimensiones de recorte inválidas.');

  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  bmp.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: clamp(quality, 0.01, 1) });
  return { blob, name: outputName };
}

/**
 * COMPRESS — Re-codifica la imagen completa a calidad reducida.
 *            Las dimensiones se preservan.
 */
async function doCompress({ arrayBuffer, mimeType, quality, outputName }) {
  const srcBlob = new Blob([arrayBuffer], { type: mimeType });
  const bmp     = await createImageBitmap(srcBlob);

  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: clamp(quality, 0.01, 1) });
  return { blob, name: outputName };
}

/**
 * RESIZE_ONLY — Escala la imagen completa (sin recortar) al tamaño de salida.
 */
async function doResizeOnly({ arrayBuffer, mimeType, outputWidth, outputHeight, quality, outputName }) {
  const srcBlob = new Blob([arrayBuffer], { type: mimeType });
  const bmp     = await createImageBitmap(srcBlob);

  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  canvas.getContext('2d').drawImage(bmp, 0, 0, outputWidth, outputHeight);
  bmp.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: clamp(quality, 0.01, 1) });
  return { blob, name: outputName };
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

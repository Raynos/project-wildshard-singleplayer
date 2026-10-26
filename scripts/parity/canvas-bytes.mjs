import { writeFileSync } from 'node:fs';
import { browserBakeBytes } from '../bake-output.mjs';

/** Encode a retained snapshot and retire its handles/routes after publication.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file */
export function saveCanvasPng(page, canvas, file) {
  return saveCanvasImage(page, canvas, file, { mime: 'image/png', quality: undefined, label: 'Board PNG' });
}

/** Publish a JPEG at its caller's original quality without a data URL.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file
 * @param {number} [quality] */
export function saveCanvasJpeg(page, canvas, file, quality = 0.9) {
  return saveCanvasImage(page, canvas, file, { mime: 'image/jpeg', quality, label: 'Playback JPEG' });
}

/** Publish an already frozen PNG snapshot, retiring its native handle.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {import('playwright').JSHandle<Blob>} blob
 * @param {string} file */
export function savePngBlob(page, blob, file) {
  return saveImageBlob(page, blob, file, { mime: 'image/png', label: 'Board PNG' });
}

/** @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file
 * @param {{mime:'image/png'|'image/jpeg',quality:number|undefined,label:string}} encoding */
async function saveCanvasImage(page, canvas, file, encoding) {
  try {
    const blob = await canvas.evaluateHandle((value, { mime, quality, label }) => {
      if (!(value instanceof HTMLCanvasElement) || value.width === 0 || value.height === 0)
        throw new Error('Invalid board canvas');
      /** @type {Promise<Blob>} */
      const encoded = new Promise((resolve, reject) => {
        value.toBlob(bytes => {
          if (bytes === null || bytes.type !== mime || bytes.size === 0) reject(new Error(`${label} encoding failed`));
          else resolve(bytes);
        }, mime, quality);
      });
      return encoded;
    }, encoding);
    await saveImageBlob(page, blob, file, encoding);
  } finally { await canvas.dispose(); }
}

/** @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {import('playwright').JSHandle<Blob>} blob
 * @param {string} file
 * @param {{mime:'image/png'|'image/jpeg',label:string}} encoding */
async function saveImageBlob(page, blob, file, encoding) {
  try {
    const size = await blob.evaluate((value, mime) => {
      if (!(value instanceof Blob) || value.type !== mime || value.size === 0) throw new Error('Invalid native image');
      return value.size;
    }, encoding.mime);
    const sink = await browserBakeBytes(page, { maxBytes: size, maxFiles: 1 });
    try {
      await blob.evaluate(async (value, { url, label }) => {
        const response = await fetch(url, { method: 'POST', body: value });
        if (!response.ok) throw new Error(`${label} upload refused`);
      }, { url: `${sink.url}frame`, label: encoding.label });
      const bytes = sink.take('frame');
      if (bytes.byteLength !== size) throw new Error(encoding.mime === 'image/png' ? 'Incomplete board PNG' : 'Incomplete playback JPEG');
      writeFileSync(file, bytes);
    } finally { await sink.dispose(); }
  } finally { await blob.dispose(); }
}

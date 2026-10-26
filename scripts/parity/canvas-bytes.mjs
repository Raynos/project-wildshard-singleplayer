import { writeFileSync } from 'node:fs';
import { browserBakeBytes } from '../bake-output.mjs';

/** Encode a retained snapshot and retire its handles/routes after publication.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file */
export function saveCanvasPng(page, canvas, file) {
  return saveCanvasImage(page, canvas, file, { mime: 'image/png', quality: undefined, label: 'Board PNG' });
}

/** Publish the playback tool's original quality-0.9 JPEG without a data URL.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file */
export function saveCanvasJpeg(page, canvas, file) {
  return saveCanvasImage(page, canvas, file, { mime: 'image/jpeg', quality: 0.9, label: 'Playback JPEG' });
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
    try {
      const size = await blob.evaluate(value => value.size);
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
  } finally { await canvas.dispose(); }
}

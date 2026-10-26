import { writeFileSync } from 'node:fs';
import { browserBakeBytes } from '../bake-output.mjs';

/** Encode a retained snapshot and retire its handles/routes after publication.
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {Pick<import('playwright').JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>} canvas
 * @param {string} file */
export async function saveCanvasPng(page, canvas, file) {
  try {
    const blob = await canvas.evaluateHandle(value => {
      if (!(value instanceof HTMLCanvasElement) || value.width === 0 || value.height === 0)
        throw new Error('Invalid board canvas');
      /** @type {Promise<Blob>} */
      const encoded = new Promise((resolve, reject) => {
        value.toBlob(bytes => {
          if (bytes === null || bytes.type !== 'image/png' || bytes.size === 0) reject(new Error('Board PNG encoding failed'));
          else resolve(bytes);
        }, 'image/png');
      });
      return encoded;
    });
    try {
      const size = await blob.evaluate(value => value.size);
      const sink = await browserBakeBytes(page, { maxBytes: size, maxFiles: 1 });
      try {
        await blob.evaluate(async (value, url) => {
          const response = await fetch(url, { method: 'POST', body: value });
          if (!response.ok) throw new Error('Board PNG upload refused');
        }, `${sink.url}frame`);
        const bytes = sink.take('frame');
        if (bytes.byteLength !== size) throw new Error('Incomplete board PNG');
        writeFileSync(file, bytes);
      } finally { await sink.dispose(); }
    } finally { await blob.dispose(); }
  } finally { await canvas.dispose(); }
}

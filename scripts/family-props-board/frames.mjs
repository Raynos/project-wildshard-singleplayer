import { writeFileSync } from 'node:fs';
import { browserBakeBytes } from '../bake-output.mjs';

/** Publish the three canvas snapshots without serializing image storage.
 * @template {{before:HTMLCanvasElement,after:HTMLCanvasElement,reference:HTMLCanvasElement}} T
 * @param {import('../bake-output.mjs').ByteSinkPage} page
 * @param {import('playwright').JSHandle<T>} handle
 * @param {{before:string,after:string,reference:string}} files
 * @returns {Promise<Omit<T,'before'|'after'|'reference'>>} */
export async function saveBoardFrames(page, handle, files) {
  try {
    const metadata = await handle.evaluate(({ before: _before, after: _after, reference: _reference, ...rest }) => rest);
    for (const side of /** @type {const} */ (['before', 'after', 'reference'])) {
      const blob = await handle.evaluateHandle((frames, key) => {
        const canvas = frames[key];
        if (!(canvas instanceof HTMLCanvasElement) || canvas.width === 0 || canvas.height === 0)
          throw new Error('Invalid board canvas');
        /** @type {Promise<Blob>} */
        const encoded = new Promise((resolve, reject) => {
          canvas.toBlob(value => {
            if (value === null || value.type !== 'image/png' || value.size === 0) reject(new Error('Board PNG encoding failed'));
            else resolve(value);
          }, 'image/png');
        });
        return encoded;
      }, side);
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
          writeFileSync(files[side], bytes);
        } finally { await sink.dispose(); }
      } finally { await blob.dispose(); }
    }
    return metadata;
  } finally { await handle.dispose(); }
}

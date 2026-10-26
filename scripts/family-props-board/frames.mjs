import { saveCanvasPng } from '../parity/canvas-bytes.mjs';

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
      await saveCanvasPng(page, await handle.getProperty(side), files[side]);
    }
    return metadata;
  } finally { await handle.dispose(); }
}

import { pageScope } from '../app/resources';
import { WORK_SLICE_MS, workSlice } from './workSlice';

/** Fetch zlib-compressed bytes without feeding a whole network chunk to the native
 * decoder in one continuation. The existing work slice gives live frames their
 * turn between 16 KiB input blocks; decoded bytes and ownership stay unchanged. */
export async function fetchDeflatedBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  const reader = response.body.getReader(), slice = workSlice(WORK_SLICE_MS, pageScope);
  let chunk: Uint8Array<ArrayBuffer> | undefined, offset = 0;
  const input = new ReadableStream<BufferSource>({
    async pull(controller) {
      if (chunk === undefined || offset === chunk.length) {
        const next = await reader.read();
        if (next.done) { controller.close(); return; }
        chunk = next.value; offset = 0;
      }
      await slice.check();
      const end = Math.min(chunk.length, offset + 16_384);
      controller.enqueue(chunk.subarray(offset, end)); offset = end;
    },
    async cancel(reason: unknown) { await reader.cancel(reason); },
  });
  try { return new Uint8Array(await new Response(input.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); }
  finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
}

/** Restore a range of four-byte words from their four byte lanes into a distinct complete buffer. */
export function unshuffleLanes(lanes: Uint8Array, out = new Uint8Array(lanes.length), wordStart = 0, wordEnd = lanes.length / 4): Uint8Array {
  if (lanes.length % 4 !== 0) throw new Error('unshuffleLanes: not whole words');
  const n = lanes.length / 4;
  if (out.length !== lanes.length || out.buffer === lanes.buffer || !Number.isSafeInteger(wordStart) || !Number.isSafeInteger(wordEnd)
    || wordStart < 0 || wordEnd < wordStart || wordEnd > n) throw new Error('unshuffleLanes: bad output/range');
  for (let b = 0; b < 4; b++) for (let i = wordStart; i < wordEnd; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

/** Inflate and restore byte lanes in page-lived slices; cached reads survive a retired construction owner. */
export async function fetchLaneBytes(url: string): Promise<Uint8Array> {
  const lanes = await fetchDeflatedBytes(url), out = new Uint8Array(lanes.length), slice = workSlice(WORK_SLICE_MS, pageScope), words = lanes.length / 4;
  for (let start = 0; start < words; start += 16_384) {
    await slice.check();
    unshuffleLanes(lanes, out, start, Math.min(words, start + 16_384));
  }
  return out;
}

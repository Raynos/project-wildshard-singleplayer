import { workSlice } from './workSlice';

/** Fetch zlib-compressed bytes without feeding a whole network chunk to the native
 * decoder in one continuation. The existing work slice gives live frames their
 * turn between 16 KiB input blocks; decoded bytes and ownership stay unchanged. */
export async function fetchDeflatedBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  const reader = response.body.getReader(), slice = workSlice();
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

/**
 * Fetch a URL through a ReadableStream and report bytes as the reader reads them — the only way
 * bytes enter the boot plan. `total` is the response's content-length when the body is not
 * encoded, else `expectedBytes`, else what has arrived so far. Ported from trials-gauntlet-demo.
 */
export async function streamBytes(url: string, onBytes: (delta: number, got: number, total: number) => void, expectedBytes = 0): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const len = Number(res.headers.get('content-length')) || 0;
  const declared = len && !res.headers.get('content-encoding') ? len : expectedBytes;
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onBytes(buf.byteLength, buf.byteLength, Math.max(declared, buf.byteLength));
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.byteLength;
    onBytes(value.byteLength, got, Math.max(declared, got));
  }
  const out = new Uint8Array(got);
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out.buffer;
}

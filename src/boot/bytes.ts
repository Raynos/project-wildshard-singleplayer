/**
 * Where the boot plan's bytes come from.
 *
 *  - `declareTotals(files)`: declared denominators per byte source, from the build's byte table
 *    (`bytes.generated.ts`) — known before the first byte, so DOWNLOAD never runs backwards.
 *  - `installByteCounter(plan, files)`: every `/assets/**` fetch (three's FileLoader / ImageBitmapLoader,
 *    our own texture loads) is teed and its bytes credited to the source that declared the file.
 *    Files a browser loads through `<img>` (GLTF textures on Safari) are credited on completion from
 *    resource timing — coarser, still real bytes.
 *  - `fetchImage(url)`: a texture as an ImageBitmap through that counted fetch, decoded off the main
 *    thread with the orientation three's ImageBitmapLoader uses.
 */
import type { Plan, ByteProgress } from './plan';
import type { BootStep, ByteKey } from './steps';
import { PUBLIC_BYTES } from './bytes.generated';

export type ChunkFiles = Readonly<Record<ByteKey, readonly string[]>>;
type Bytes = Record<string, number>;
const TABLE = PUBLIC_BYTES as unknown as Bytes;

export function declareTotals(files: ChunkFiles): Record<ByteKey, { bytes: number; files: number }> {
  const out = {} as Record<ByteKey, { bytes: number; files: number }>;
  for (const key of Object.keys(files) as ByteKey[]) {
    let bytes = 0;
    for (const f of files[key]) {
      if (!(f in TABLE)) throw new Error(`boot: ${key} declares ${f} but public/assets has no such file`);
      bytes += TABLE[f] ?? 0;
    }
    out[key] = { bytes, files: files[key].length };
  }
  return out;
}

const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

export function installByteCounter(plan: Plan<BootStep>, files: ChunkFiles): void {
  const sourceOf = new Map<string, ByteKey>();
  for (const key of Object.keys(files) as ByteKey[]) for (const f of files[key]) sourceOf.set(f, key);
  const readers = new Map<ByteKey, ByteProgress>();
  const reader = (k: ByteKey) => { let r = readers.get(k); if (!r) { r = plan.reader(k); readers.set(k, r); } return r; };
  const seen = new Set<string>();     // files whose bytes were counted by the tee
  const finished = new Set<string>();

  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const p = pathOf(url);
    const key = sourceOf.get(p);
    if (!key || seen.has(p)) return orig(input, init);
    seen.add(p);
    const res = await orig(input, init);
    if (!res.ok || !res.body) { return res; }
    const r = reader(key);
    const [a, b] = res.body.tee();
    // drain the twin, crediting bytes as they land; the caller consumes `a` untouched
    (async () => {
      const rd = b.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; r.add(value.byteLength); }
      finished.add(p); plan.fileDone(key);
    })().catch(() => undefined);
    return new Response(a, { status: res.status, statusText: res.statusText, headers: res.headers });
  };

  // <img>-loaded files never pass through fetch: credit them when resource timing reports them done.
  if ('PerformanceObserver' in window) {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        const p = pathOf(e.name);
        const key = sourceOf.get(p);
        if (!key || seen.has(p) || finished.has(p)) continue;
        finished.add(p);
        reader(key).add(e.encodedBodySize || e.transferSize || (TABLE[p] ?? 0) || 0);
        plan.fileDone(key);
      }
    });
    po.observe({ type: 'resource', buffered: true });
  }
}

/**
 * Decode an image off the main thread through the counted fetch, downscaled to `maxSize` when the
 * file is larger (the phone tier's 1024 cap). `flip` matches three's ImageBitmapLoader (then
 * texture.flipY must be false); pass false for canvas work that keeps the file's orientation.
 */
export async function fetchImage(url: string, maxSize = Infinity, flip = true): Promise<ImageBitmap | HTMLImageElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    try {
      const opts: ImageBitmapOptions = { imageOrientation: flip ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
      if (Number.isFinite(maxSize)) {
        // one decode at natural size to learn the dimensions is what we are avoiding: probe the header cheaply
        const dim = await imageSize(blob);
        if (dim && Math.max(dim.w, dim.h) > maxSize) {
          const k = maxSize / Math.max(dim.w, dim.h);
          opts.resizeWidth = Math.round(dim.w * k); opts.resizeHeight = Math.round(dim.h * k); opts.resizeQuality = 'high';
        }
      }
      return await createImageBitmap(blob, opts);
    } catch { /* fall through */ }
  }
  const src = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => { resolve(img); }; img.onerror = reject; img.src = src; });
  } finally { URL.revokeObjectURL(src); }
}

/** Width/height from the JPEG / PNG header — a few bytes, no decode. */
async function imageSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  const head = new DataView(await blob.slice(0, 65536).arrayBuffer());
  if (head.byteLength > 24 && head.getUint32(0) === 0x89504e47) return { w: head.getUint32(16), h: head.getUint32(20) }; // PNG IHDR
  if (head.byteLength > 4 && head.getUint16(0) === 0xffd8) { // JPEG: walk the segments to SOF0/2
    let o = 2;
    while (o + 9 < head.byteLength) {
      if (head.getUint8(o) !== 0xff) return null;
      const marker = head.getUint8(o + 1);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) return { h: head.getUint16(o + 5), w: head.getUint16(o + 7) };
      o += 2 + head.getUint16(o + 2);
    }
  }
  return null;
}

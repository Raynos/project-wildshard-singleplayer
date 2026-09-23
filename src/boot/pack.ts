/**
 * The boot pack (scripts/bake-packs.mjs; project/archive/2026-09-22-load-perf.md "requests, first launch ≤ 20"): this shard's boot
 * files for this tier, concatenated in step order into one content-addressed file. `streamPack` fetches it once and
 * cuts it into its files as the bytes land; the first file is ready after its own bytes, not after the pack's.
 *
 * Nothing downstream changes: the steps still `fetch()` their files by name (fetchImage, three's FileLoader /
 * ImageBitmapLoader, the baked-terrain reader), and a GET of a packed path is answered with that file's bytes from
 * the pack — waiting for them when they have not landed yet. Loaders that bypass fetch (Safari's GLTFLoader loads
 * textures through <img>) are handed a blob: URL through the loading manager once the file is in; the pack puts glTF
 * textures ahead of their .gltf so that is always the case by the time the model asks.
 *
 * The DOWNLOAD track is credited here as the pack streams (per file, to the source that declared it), since the
 * byte counter's fetch tee never sees the packed paths. A pack that fails to arrive (404 on a stale deploy, offline
 * with an empty cache) is not fatal: every packed path still waiting falls back to its own request.
 *
 * `?nopack=1` boots file by file (the per-file prefetch) — the A/B for this module.
 */
import { DefaultLoadingManager } from 'three';
import type { ChunkDef } from '../chunks/ChunkDef';
import type { Plan } from './plan';
import type { BootStep, ByteKey } from './steps';
import { tierUrl, type ChunkFiles } from './bytes';
import { PACKS, type PackDef } from './packs.generated';
import { TIER } from '../core/tier';

const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

/** This shard's pack for this tier, when the build has one and the URL doesn't opt out. */
export function packFor(def: ChunkDef): PackDef | null {
  if (new URLSearchParams(location.search).has('nopack')) return null;
  return PACKS[def.slug]?.[TIER] ?? null;
}

interface Slot { type: string; size: number; blob: Promise<Blob>; resolve: (b: Blob) => void; reject: (e: unknown) => void; url: string | null }

/**
 * Start streaming `pack` and answer every GET of a packed path from it. Installed after the byte counter and the
 * service worker (so the pack itself is cached like any other asset). Returns the number of packed files.
 */
export function streamPack(pack: PackDef, plan: Plan<BootStep>, files: ChunkFiles): number {
  const sourceOf = new Map<string, ByteKey>();
  for (const key of Object.keys(files) as ByteKey[]) for (const f of files[key]) sourceOf.set(f, key);
  const slots = new Map<string, Slot>();
  for (const [p, , size, type] of pack.files) {
    let resolve: (b: Blob) => void = () => undefined, reject: (e: unknown) => void = () => undefined;
    const blob = new Promise<Blob>((_resolve, _reject) => { resolve = _resolve; reject = _reject; });
    blob.catch(() => undefined); // a failed pack is answered per request (fallback below), never an unhandled rejection
    slots.set(p, { type, size, blob, resolve, reject, url: null });
  }
  const fetchNow = window.fetch.bind(window);

  void (async () => {
    const res = await fetchNow(pack.url);
    if (!res.ok || !res.body) throw new Error(`${res.status} ${pack.url}`);
    const reader = res.body.getReader();
    let i = 0, at = 0; // file index, bytes of the pack consumed
    let parts: Uint8Array<ArrayBuffer>[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      while (chunk.byteLength > 0 && i < pack.files.length) {
        const file = pack.files[i];
        if (file === undefined) break;
        const [p, offset, size, type] = file;
        const take = chunk.subarray(0, Math.min(offset + size - at, chunk.byteLength));
        parts.push(take);
        at += take.byteLength;
        chunk = chunk.subarray(take.byteLength);
        const key = sourceOf.get(p);
        if (key) plan.reader(key).add(take.byteLength);
        if (at === offset + size) {
          const blob = new Blob(parts, { type });
          parts = [];
          i++;
          const slot = slots.get(p);
          if (slot) { slot.url = URL.createObjectURL(blob); slot.resolve(blob); }
          if (key) plan.fileDone(key);
        }
      }
    }
    if (i < pack.files.length) throw new Error(`pack ended after ${i} / ${pack.files.length} files: ${pack.url}`);
  })().catch((e: unknown) => {
    console.warn('[pack] falling back to per-file requests:', e);
    for (const s of slots.values()) if (s.url === null) s.reject(e);
  });

  window.fetch = (input, init) => {
    const req = input instanceof Request ? input : null;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const p = pathOf(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const slot = method === 'GET' ? slots.get(p) : undefined;
    if (slot === undefined) return fetchNow(input, init);
    return slot.blob.then(
      (blob) => new Response(blob, { status: 200, headers: { 'content-type': slot.type, 'content-length': String(slot.size) } }),
      () => fetchNow(input, init),
    );
  };

  // <img>-based loaders (Safari's GLTFLoader textures): a packed file that has landed is loaded from memory
  DefaultLoadingManager.setURLModifier((url) => {
    const u = tierUrl(url);
    return slots.get(pathOf(u))?.url ?? u;
  });
  return slots.size;
}

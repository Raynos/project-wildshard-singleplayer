/**
 * The boot pack (scripts/bake-packs.mjs; project/archive/2026-09-22-load-perf.md "requests, first launch ≤ 20"): this shard's boot
 * files for this tier, concatenated in step order into a few content-addressed parts (E160: one file per pack meant any
 * edit re-downloaded all of it). `streamPack` fetches the parts one after another and cuts each into its files as the
 * bytes land; the first file is ready after its own bytes, not after the pack's.
 *
 * Nothing downstream changes: the steps still `fetch()` their files by name (fetchImage, three's FileLoader /
 * ImageBitmapLoader, the baked-terrain reader), and a GET of a packed path is answered with that file's bytes from
 * the pack — waiting for them when they have not landed yet. Loaders that bypass fetch (Safari's GLTFLoader loads
 * textures through <img>) are handed a blob: URL through the loading manager once the file is in; the pack puts glTF
 * textures ahead of their .gltf (and never cuts a part between them) so that is always the case by the time the model asks.
 *
 * The DOWNLOAD track is credited here as the pack streams (per file, to the source that declared it), since the
 * byte counter's fetch tee never sees the packed paths. A part that fails to arrive (404 on a stale deploy, offline
 * with an empty cache) is not fatal: every packed path still waiting falls back to its own request.
 *
 * A part fetched before the service worker controlled the page (a first visit on a slow link: main.ts waits ≤ 2.5 s for
 * the claim) went past the worker's cache; once a worker controls the page it is handed the part's bytes (sw.js STORE),
 * so the next launch — and an offline one — reads it from the cache instead of downloading it again (E158: the bench's
 * Pine Hollow 4g/warm run re-downloaded the whole 18 MB pack).
 *
 * `?nopack=1` boots file by file (the per-file prefetch) — the A/B for this module.
 */
import { DefaultLoadingManager } from 'three';
import type { ChunkDef } from '../chunks/ChunkDef';
import type { Plan } from './plan';
import type { BootStep, ByteKey } from './steps';
import { tierUrl, versionedUrl, type ChunkFiles } from './bytes';
import { PACKS, type PackDef, type PackPart } from './packs.generated';
import { TIER } from '../core/tier';

const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

/** This shard's pack for this tier, when the build has one and the URL doesn't opt out. */
export function packFor(def: ChunkDef): PackDef | null {
  if (new URLSearchParams(location.search).has('nopack')) return null;
  return PACKS[def.slug]?.[TIER] ?? null;
}

/**
 * The parts of `pack` a boot declaring `files` reads: every part that carries one of them. The pack is baked for the
 * default path (images); a KTX2 boot (E157) declares the KTX2 stand-ins instead, and a part that holds only the images
 * they replace is not streamed (nor background-downloaded, src/boot/shardPrefetch.ts).
 */
export function bootParts(pack: PackDef, files: ChunkFiles): PackDef {
  const declared = new Set(Object.values(files).flat());
  const parts = pack.parts.filter((part) => part.files.some(([p]) => declared.has(p)));
  return parts.length === pack.parts.length ? pack : { parts, bytes: parts.reduce((n, part) => n + part.bytes, 0), files: parts.flatMap((part) => part.files) };
}

/** the next part starts downloading once this share of the current one has streamed: no idle round trip between parts */
const OVERLAP = 0.75;

interface Slot { type: string; size: number; blob: Promise<Blob>; resolve: (b: Blob) => void; reject: (e: unknown) => void; url: string | null }

/** A service worker controls the page (sw.ts): a fetch now passes through its cache. */
const controlled = (): boolean => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;

/**
 * Hand a part the worker never saw to its cache (sw.js STORE) once a worker controls the page — now, or at the claim.
 * Best effort: no worker, an older one without STORE, or no claim within the minute leaves it to the HTTP cache as before.
 */
function handToWorker(url: string, blob: Blob): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const post = (): void => { sw.controller?.postMessage({ type: 'STORE', url, blob }); };
  if (sw.controller) { post(); return; }
  const expiry: { timer?: ReturnType<typeof setTimeout> } = {};
  const onClaim = (): void => { clearTimeout(expiry.timer); post(); };
  expiry.timer = setTimeout(() => { sw.removeEventListener('controllerchange', onClaim); }, 60_000);
  sw.addEventListener('controllerchange', onClaim, { once: true });
}

/**
 * Start streaming `pack` and answer every GET of a packed path from it. Installed after the byte counter and the
 * service worker (so each part is cached like any other asset). Resolves when the pack has streamed to its end (or
 * failed and handed its files to per-file requests): src/boot/extras.ts queues the art and audio after it, so they do not
 * split the pipe with the files the world's steps are waiting for.
 */
export function streamPack(whole: PackDef, plan: Plan<BootStep>, files: ChunkFiles): Promise<void> {
  const pack = bootParts(whole, files);
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
  interface PartRequest { res: Promise<Response>; bypassed: boolean }
  /** `bypassed`: no worker controls the page as the request goes out — it goes straight to the network, uncached */
  const request = (part: PackPart): PartRequest => {
    const res = fetchNow(part.url);
    res.catch(() => undefined); // a failed part surfaces when it is streamed
    return { res, bypassed: !controlled() };
  };

  /** one part: cut into its files as it lands; `nearlyDone` fires at OVERLAP so the next part can start */
  const streamPart = async (part: PackPart, { res: response, bypassed }: PartRequest, nearlyDone: () => void): Promise<void> => {
    const res = await response;
    if (!res.ok || !res.body) throw new Error(`${res.status} ${part.url}`);
    const reader = res.body.getReader();
    const blobs: Blob[] = [];
    let i = 0, at = 0, signalled = false; // file index, bytes of the part consumed
    let parts: Uint8Array<ArrayBuffer>[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      while (chunk.byteLength > 0 && i < part.files.length) {
        const file = part.files[i];
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
          blobs.push(blob);
          const slot = slots.get(p);
          if (slot) { slot.url = URL.createObjectURL(blob); slot.resolve(blob); }
          if (key) plan.fileDone(key);
        }
      }
      if (!signalled && at >= part.bytes * OVERLAP) { signalled = true; nearlyDone(); }
    }
    if (!signalled) nearlyDone();
    if (i < part.files.length) throw new Error(`pack part ended after ${i} / ${part.files.length} files: ${part.url}`);
    if (bypassed) handToWorker(part.url, new Blob(blobs, { type: 'application/octet-stream' }));
  };

  const streamed = (async () => {
    // part k + 1 is requested once part k is OVERLAP streamed; its body waits in the network stack until k is read out
    const ahead: { req: PartRequest | null } = { req: null };
    for (let k = 0; k < pack.parts.length; k++) {
      const part = pack.parts[k];
      if (part === undefined) break;
      const req = ahead.req ?? request(part);
      ahead.req = null;
      const following = pack.parts[k + 1];
      await streamPart(part, req, () => { if (following) ahead.req = request(following); });
    }
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
    return slots.get(pathOf(u))?.url ?? versionedUrl(u);
  });
  return streamed;
}

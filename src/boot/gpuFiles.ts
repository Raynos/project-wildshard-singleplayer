/**
 * GPU-compressed textures (E157): which file a loader fetches when textures ride as KTX2 instead of images.
 *
 * A JPEG / WebP decodes to RGBA8 on the GPU — 4 bytes a texel, ~5.3 with mips — however small the file was. KTX2 / Basis
 * Universal files (scripts/bake-ktx2.mjs) are transcoded to a format the GPU samples compressed: ASTC 4×4 on the iPhone
 * (1 byte a texel), BC7 / ASTC on desktop, ETC2 for the ETC1S planes (½ byte). Same pictures, a quarter of the memory,
 * no decode on the main thread and no mipmap generation — which is what lets several shards stay resident on a phone.
 *
 * `gpuFile(served)` maps a URL the tier already fetches (after `tierUrl`: the phone's `.phone.webp` / `.phone.glb`) to its
 * KTX2 stand-in (`/assets/gpu/…-<hash8>.ktx2|glb|gltf`, content-addressed), or undefined — no stand-in, or this page
 * loads images. Images: the texture loaders ask (src/core/ktx2.ts); models: `tierUrl` itself swaps a .glb / .gltf
 * (src/boot/bytes.ts), so three's loaders, the boot pack and the manifest all see the same file. Every lookup also takes
 * an explicit mode (`standIn(served, tex)`), so a list can be computed for the OTHER mode (the background download).
 *
 * WHICH mode a page loads with (E157 B, the user: "images on the first visit, KTX2 from the next launch"):
 *   pause ▸ Settings ▸ Debug ▸ GPU textures = Images   never KTX2;
 *                                           = KTX2     always KTX2 (a set not cached yet downloads with the boot);
 *                                           = Auto     KTX2 once THIS shard's whole KTX2 set for this tier is in the service
 *                                                      worker's cache — src/boot/shardPrefetch.ts downloads it in the
 *                                                      background after the first visit and, when the worker has confirmed
 *                                                      every file, writes a marker (the set's hash) that the next page load
 *                                                      reads here. A half-downloaded set has no marker: images.
 * Resolved once per SHARD BUILD, on the build's first question (`texMode()`), and never changed inside it: no swap in a
 * running world. E155 builds several shards in one page (src/shard/ShardHost.ts): the answer is shard state
 * (src/core/shardState.ts) — reset before each build, so every build asks for its own shard (the `?chunk=` the host keeps on
 * the address), and put back when a resident shard plays again. An explicit Debug pick applies to every build. The
 * resolver that checks the marker is registered by shardPrefetch.ts (it owns the set's list); a page that never loads it
 * (dev pages, the bake scripts in Node) reads Auto as Images.
 */
import { GPU_FILES } from './gpu.generated';
import { TIER } from '../core/tier';
import { setting } from '../ui/Settings';
import { shardSlot } from '../core/shardState';

export type TexMode = 'ktx2' | 'img';

/** the shard being built (src/chunks/registry.ts chunkSlugFromUrl — read here without loading every chunk def): the shard
 *  host puts `?chunk=` on the address before a build, so a later build reads its own */
const buildSlug = (): string => (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('chunk') ?? 'driftwood-isle');
/** a page that may load KTX2 in some build (Debug ▸ GPU textures is not Images): its model / texture caches are per shard
 *  (KTX2 drops a texture's mips once uploaded — another renderer could not upload a cached copy; E155) */
export const MAY_KTX2 = setting('tex') !== 'img';

let autoReady: ((slug: string) => boolean) | null = null;
/** shardPrefetch.ts: how Auto learns that a shard's KTX2 set is cached (the marker check) */
export function setAutoKtx2Check(fn: (slug: string) => boolean): void { autoReady = fn; }

let resolved: { mode: TexMode; why: string } | null = null;
let resolving = false;
/** the mode this page loads with, and why (fixed on the first call) */
export function texModeWhy(): { mode: TexMode; why: string } {
  if (resolved) return resolved;
  if (resolving) throw new Error('texMode(): asked while it is being resolved — pass the mode explicitly');
  resolving = true;
  try {
    const picked = setting('tex');
    if (picked !== 'auto') resolved = { mode: picked, why: `picked (Settings ▸ Debug ▸ GPU textures: ${picked})` };
    else { const slug = buildSlug(); resolved = autoReady?.(slug) === true ? { mode: 'ktx2', why: `auto: ${slug}'s KTX2 set is cached` } : { mode: 'img', why: `auto: ${slug}'s KTX2 set is not cached (yet)` }; }
  } finally { resolving = false; }
  return resolved;
}
export const texMode = (): TexMode => texModeWhy().mode;

/** the KTX2 stand-in of `served` (a path, after tierUrl) in mode `tex`, or undefined */
export function standIn(served: string, tex: TexMode): string | undefined {
  return tex === 'ktx2' ? GPU_FILES[TIER][served] : undefined;
}
/** the KTX2 stand-in of a file this tier fetches, when this page loads KTX2 */
export function gpuFile(served: string): string | undefined {
  return standIn(served, texMode());
}

// E155: each shard build resolves its own mode (a fresh page's first question); a resident shard keeps the one it built with
shardSlot<{ mode: TexMode; why: string } | null>('gpuFiles.texMode', () => resolved, (v) => { resolved = v; }, () => null);

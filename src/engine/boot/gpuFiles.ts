/**
 * GPU-compressed textures (E157): which file a loader fetches when textures ride as KTX2 instead of images.
 *
 * A JPEG / WebP decodes to RGBA8 on the GPU — 4 bytes a texel, ~5.3 with mips — however small the file was. KTX2 / Basis
 * Universal files (scripts/bake-ktx2.mjs) are transcoded to a format the GPU samples compressed: ASTC 4×4 on the iPhone
 * (1 byte a texel), ASTC 4×4 on an Apple Silicon Mac's Chrome too (ANGLE Metal exposes no BPTC), BC7 on a desktop GPU that
 * has it, ETC2 for the ETC1S planes (½ byte; BC1 / BC3 where there is no ETC2). Same pictures, a quarter of the memory,
 * no decode on the main thread and no mipmap generation — which is what lets several shards stay resident on a phone.
 * Both tiers have their own set (E173: the desktop's at the full-res files' size; Pine Hollow 950 → 360 MB of textures).
 *
 * `gpuFile(served)` maps a URL the tier already fetches (after `tierUrl`: the phone's `.phone.webp` / `.phone.glb`) to its
 * KTX2 stand-in (`/assets/gpu/…-<hash8>.ktx2|glb|gltf`, content-addressed), or undefined — no stand-in, or this page
 * loads images. Images: the texture loaders ask (src/engine/core/ktx2.ts); models: `tierUrl` itself swaps a .glb / .gltf
 * (src/engine/boot/bytes.ts), so three's loaders, the boot pack and the manifest all see the same file. Every lookup also takes
 * an explicit mode (`standIn(served, tex)`), so a list can be computed for the OTHER mode (the background download).
 *
 * WHICH mode a page loads with (E157 B, the user: "images on the first visit, KTX2 from the next launch"):
 *   pause ▸ Settings ▸ Debug ▸ GPU textures = Images   never KTX2;
 *                                           = KTX2     always KTX2 (a set not cached yet downloads with the boot);
 *                                           = Auto     KTX2 once THIS shard's whole KTX2 set for this tier is in the service
 *                                                      worker's cache — src/engine/boot/shardPrefetch.ts downloads it in the
 *                                                      background after the first visit and, when the worker has confirmed
 *                                                      every file, writes a marker (the set's hash) that the next page load
 *                                                      reads here. A half-downloaded set has no marker: images.
 * A level may fix Auto's texture mode through its tier data. An explicit Debug pick still wins.
 * Resolved once per SHARD BUILD, on the build's first question (`texMode()`), and never changed inside it: no swap in a
 * running world. One page builds one level; navigation rebuilds the selected level on a fresh page.
 * The explicit Debug pick applies to that page's build. The
 * resolver that checks the marker is registered by shardPrefetch.ts (it owns the set's list); a page that never loads it
 * (dev pages, the bake scripts in Node) reads Auto as Images.
 */

import { GPU_FILES as ENGINE_GPU_FILES } from './ktx2.generated';
import { TIER } from '../core/tier';
import { PAGE_LEVEL } from '../core/config';
import { setting } from '../ui/Settings';

export interface Ktx2Table { readonly phone: Readonly<Record<string, string>>; readonly desktop: Readonly<Record<string, string>> }
const GPU_FILES = { phone: { ...ENGINE_GPU_FILES.phone }, desktop: { ...ENGINE_GPU_FILES.desktop } };
let registered = { phone: new Set(Object.values(GPU_FILES.phone)), desktop: new Set(Object.values(GPU_FILES.desktop)) };
export function registerGpuFiles(table: Ktx2Table): void {
  Object.assign(GPU_FILES.phone, table.phone);
  Object.assign(GPU_FILES.desktop, table.desktop);
  registered = { phone: new Set(Object.values(GPU_FILES.phone)), desktop: new Set(Object.values(GPU_FILES.desktop)) };
}

/** Whether this tier's registered KTX2 mappings name a URL, including shard overlays outside /assets/gpu/. */
export function isRegisteredGpuFile(url: string): boolean {
  return registered[TIER].has(url.replace(/[?#].*$/u, ''));
}

export type TexMode = 'ktx2' | 'img';

/** the one level selected for this page (core/config's PAGE_LEVEL: captured by the registry's first apply) */
/** the level a build's texture policy is for (setTexturePolicy); the page's level when unset */
let policyLevel: string | undefined;
const buildSlug = (): string => policyLevel ?? PAGE_LEVEL;
/** a page that may load KTX2 in some build (Debug ▸ GPU textures is not Images): its model / texture caches are per shard
 *  (KTX2 drops a texture's mips once uploaded — another renderer could not upload a cached copy; E155) */
export const MAY_KTX2 = setting('tex') !== 'img';

let autoReady: ((slug: string) => boolean) | null = null;
/** shardPrefetch.ts: how Auto learns that a shard's KTX2 set is cached (the marker check) */
export function setAutoKtx2Check(fn: (slug: string) => boolean): void { autoReady = fn; }

let resolved: { mode: TexMode; why: string } | null = null;
let texturePolicy: TexMode | undefined;
/** The composition root installs tier data before this build resolves its file list. */
/** a build's texture policy (its tier's `textures`) and the level it is for (the page's level when omitted); the mode resolves afresh */
export function setTexturePolicy(mode: TexMode | undefined, level?: string): void { texturePolicy = mode; policyLevel = level; resolved = null; }
let resolving = false;
/** the mode this page loads with, and why (fixed on the first call) */
export function texModeWhy(): { mode: TexMode; why: string } {
  if (resolved) return resolved;
  if (resolving) throw new Error('texMode(): asked while it is being resolved — pass the mode explicitly');
  resolving = true;
  try {
    const picked = setting('tex');
    if (picked !== 'auto') resolved = { mode: picked, why: `picked (Settings ▸ Debug ▸ GPU textures: ${picked})` };
    else {
      const slug = buildSlug();
      if (texturePolicy !== undefined) resolved = { mode: texturePolicy, why: 'auto: level tier texture policy' };
      else resolved = autoReady?.(slug) === true ? { mode: 'ktx2', why: `auto: ${slug}'s KTX2 set is cached` } : { mode: 'img', why: `auto: ${slug}'s KTX2 set is not cached (yet)` };
    }
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

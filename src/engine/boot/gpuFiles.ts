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
 * G188: a measured images-first playing estimate above the phone cap selects KTX2 on the first visit.
 * A level may otherwise fix Auto through tier data. An explicit Debug pick still wins; desktop is unchanged.
 * Resolved once per SHARD BUILD, on the build's first question (`texMode()`), and never changed inside it: no swap in a
 * running world. One page builds one level; navigation rebuilds the selected level on a fresh page.
 * The explicit Debug pick applies to that page's build. The
 * resolver that checks the marker is registered by shardPrefetch.ts (it owns the set's list); a page that never loads it
 * (dev pages, the bake scripts in Node) reads Auto as Images.
 */

import { GPU_FILES as ENGINE_GPU_FILES } from './ktx2.generated';
import { TIER } from '../core/tier';
import { CONTENT_CAPS, PAGE_LEVEL } from '../core/config';
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
interface TexturePolicyState {
  readonly level: string | undefined;
  readonly policy: { mode: TexMode; why: string } | undefined;
  resolved: { mode: TexMode; why: string } | null;
}
let pagePolicy: TexturePolicyState = { level: undefined, policy: undefined, resolved: null };
const policyFrames: { state: TexturePolicyState }[] = [];
const activePolicy = (): TexturePolicyState => policyFrames.at(-1)?.state ?? pagePolicy;
/** a page that may load KTX2 in some build (Debug ▸ GPU textures is not Images): its model / texture caches are per shard
 *  (KTX2 drops a texture's mips once uploaded — another renderer could not upload a cached copy; E155) */
export const MAY_KTX2 = setting('tex') !== 'img';

let autoReady: ((slug: string) => boolean) | null = null;
/** shardPrefetch.ts: how Auto learns that a shard's KTX2 set is cached (the marker check) */
export function setAutoKtx2Check(fn: (slug: string) => boolean): void { autoReady = fn; }

/** G188's automatic tier policy: measured over-cap phone builds use KTX2 before the first visit, never desktop. */
export function autoTexturePolicy(mode: TexMode | undefined, imagesFirstPlayingBytes?: number): { mode: TexMode; why: string } | undefined {
  if (imagesFirstPlayingBytes !== undefined && (!Number.isSafeInteger(imagesFirstPlayingBytes) || imagesFirstPlayingBytes < 0)) throw new RangeError('Invalid images-first playing estimate');
  if (TIER === 'phone' && imagesFirstPlayingBytes !== undefined && imagesFirstPlayingBytes > CONTENT_CAPS.playing) {
    return { mode: 'ktx2', why: `auto: images-first playing estimate ${imagesFirstPlayingBytes} exceeds ${CONTENT_CAPS.playing}` };
  }
  return mode === undefined ? undefined : { mode, why: 'auto: level tier texture policy' };
}
/** The composition root installs tier data before this build resolves its file list. */
/** a build's texture policy (its tier's `textures`) and the level it is for (the page's level when omitted); the mode resolves afresh */
export function setTexturePolicy(mode: TexMode | undefined, level?: string, imagesFirstPlayingBytes?: number): void {
  pagePolicy = { level, policy: autoTexturePolicy(mode, imagesFirstPlayingBytes), resolved: null };
}
/**
 * One resident's immutable texture choice, resolved once with the ordinary Debug/Auto precedence.
 * Enter with its frame or exclusive asset-build scope and release before another frame resumes.
 * Nested and out-of-order leaves preserve both the resident choice and the configured home choice.
 */
export class TexturePolicyBinding {
  private readonly state: TexturePolicyState;
  constructor(mode: TexMode | undefined, level: string, imagesFirstPlayingBytes?: number) {
    this.state = { level, policy: autoTexturePolicy(mode, imagesFirstPlayingBytes), resolved: null };
  }
  enter(): () => void {
    const frame = { state: this.state }; policyFrames.push(frame);
    return () => { const index = policyFrames.indexOf(frame); if (index !== -1) policyFrames.splice(index, 1); };
  }
}
let resolving = false;
/** the mode this page loads with, and why (fixed on the first call) */
export function texModeWhy(): { mode: TexMode; why: string } {
  const state = activePolicy();
  if (state.resolved !== null) return state.resolved;
  if (resolving) throw new Error('texMode(): asked while it is being resolved — pass the mode explicitly');
  resolving = true;
  try {
    const picked = setting('tex');
    if (picked !== 'auto') state.resolved = { mode: picked, why: `picked (Settings ▸ Debug ▸ GPU textures: ${picked})` };
    else {
      const slug = state.level ?? PAGE_LEVEL;
      if (state.policy !== undefined) state.resolved = state.policy;
      else state.resolved = autoReady?.(slug) === true ? { mode: 'ktx2', why: `auto: ${slug}'s KTX2 set is cached` } : { mode: 'img', why: `auto: ${slug}'s KTX2 set is not cached (yet)` };
    }
  } finally { resolving = false; }
  return state.resolved;
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

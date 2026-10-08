/**
 * Content rendered into a texture once at load (a runtime bake: the pine impostor atlas, the branch-card fallback) lives
 * only on the GPU, so an in-place WebGL restore brings it back empty. A module that makes such a bake marks it here, and
 * src/engine/core/GpuRecovery.ts reloads the page on a context loss instead of restoring in place (E54).
 */
import { BufferAttribute, type BufferGeometry, Data3DTexture, DataArrayTexture, DataTexture, StaticDrawUsage, type Texture } from 'three';
import { enteredOwner } from '../app/ownership';
import { resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';

const labels = new Set<string>();
/** marks made outside any shard (at module load: KTX2 mode drops every texture's mips once uploaded) — the page's, never reset */
const pageLabels = new Set<string>();

export function markGpuOnly(label: string): void { (enteredOwner() === null ? pageLabels : labels).add(label); }

/**
 * A runtime bake that can paint itself again (Nalati's painted range, look v2's shadow / contact bake) registers its
 * re-bake here instead of marking itself GPU-only: an in-place restore calls it after re-linking the programs, before
 * the first frame (NALATI-MERGE F7), so the restore stays in place instead of reloading the page.
 */
const rebakes = new Set<() => void>();
/** Repaint callback owned by its captured resource lifetime; disposal removes its captured scene and textures. */
export function onGpuRestored(rebake: () => void, scope: Scope = resourceScope()): void {
  if (scope.disposed) return;
  rebakes.add(rebake);
  scope.onDispose(() => { rebakes.delete(rebake); });
}
/** GpuRecovery.ts: re-paint every registered bake (after an in-place restore) */
export function rebakeGpuContent(): void { for (const f of rebakes) f(); }

/** what was marked (empty: an in-place restore brings the whole scene back) */
export function gpuOnlyContent(): readonly string[] { return [...pageLabels, ...labels]; }

/** BufferAttribute.onUpload: drop the CPU copy once it is on the GPU (the count stays; nothing reads the array again) */
function releaseCpuCopy(this: BufferAttribute): void { this.array = this.array.slice(0, 0); }

/**
 * E264: a static mesh's vertex data, on the GPU only once drawn. Every static attribute but `keep` gives up its CPU copy
 * the moment it is uploaded (tens of bytes a vertex across a shard's merged kits). `position` stays by default: the
 * Explorer's tap picking raycasts the meshes models are drawn into, and its boxes read their vertices. The index stays
 * too, for the raycast. The bounds are computed first: frustum culling and Box3.setFromObject read them, never the
 * arrays. Call it where the mesh is made, before its first draw (a hook set after the upload never fires). Only for a
 * geometry nothing rewrites, clones or reads after its first draw. A lost context reloads the page rather than restoring
 * in place (`label`, above). Returns the bytes that will go.
 */
export function gpuOnlyAttributes(g: BufferGeometry, label: string, keep: readonly string[] = ['position']): number {
  if (g.boundingBox === null) g.computeBoundingBox();
  if (g.boundingSphere === null) g.computeBoundingSphere();
  let bytes = 0;
  for (const [name, a] of Object.entries(g.attributes)) {
    if (keep.includes(name) || !(a instanceof BufferAttribute) || a.usage !== StaticDrawUsage) continue;
    bytes += a.array.byteLength;
    a.onUpload(releaseCpuCopy);
  }
  if (bytes > 0) markGpuOnly(label);
  return bytes;
}

/** Texture.onUpdate: let go of the texture's CPU source once it is on the GPU (a bitmap closed, a canvas shrunk to one
 *  pixel, a data array emptied, a decoded image let go: only its size stays) */
function releaseSource(t: Texture): void {
  const im: unknown = t.image;
  if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) im.close();
  else if (typeof HTMLCanvasElement !== 'undefined' && im instanceof HTMLCanvasElement) { im.width = 1; im.height = 1; }
  else if (typeof HTMLImageElement !== 'undefined' && im instanceof HTMLImageElement) t.image = { width: im.width, height: im.height };
  else if ((t instanceof DataTexture || t instanceof DataArrayTexture || t instanceof Data3DTexture) && t.image.data instanceof Uint8Array) t.image.data = new Uint8Array(0);
}

/**
 * E264: a texture whose CPU source (decoded image, canvas or pixel array) nothing reads after its upload: it is released
 * the moment the texture is uploaded (its size and format stay, the GPU copy is untouched). Set it before the first draw.
 * Only for a texture nothing updates again. A lost context reloads the page (`label`).
 */
export function gpuOnlyTexture(t: Texture, label: string): void {
  // oxlint-disable-next-line wildshard/no-hook-chain -- three.js's Texture.onUpdate is a third-party one-slot hook; the release runs once, then hands it back
  const prev = t.onUpdate;
  t.onUpdate = (tex: Texture): void => {
    prev?.(tex);
    releaseSource(tex);
    t.onUpdate = prev;
  };
  markGpuOnly(label);
}

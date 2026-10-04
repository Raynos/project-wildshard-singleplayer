/**
 * SF22d (E435): the Memory saver, pause ▸ Settings ▸ Debug ▸ Loading & memory, default off, a reload. The engine's memory
 * cuts from the Pine Hollow / Driftwood breakdown (docs/design/mmo/research/e435/memory-pine-driftwood.md, `4ec64f071`)
 * that change no look, behind one row until a phone reading backs them (RENDERING.md: a risky memory change ships
 * default-off):
 *
 * 1. three.js's CPU copies go once they are on the GPU. A texture file's decoded image (loadTexture's ImageBitmap or
 *    <img>) is let go at its upload (`watchTexture`) and the image cache of `loadImage` lets go of it too (assets.ts);
 *    one source per file, so a file used twice uploads once. A GLB's embedded image, canvases and data textures stay
 *    (code reads or redraws them after the upload; KTX2 textures already drop their mips, ktx2.ts). A static geometry's attributes but `position`,
 *    the skin weights and the index give up their arrays once the geometry has drawn unchanged for a while
 *    (`watchGeometry`): the full drop (positions and indices too) stalled Driftwood's re-walk, something reads them.
 * 2. The practice dummies load when the room opens, not ahead (play.ts).
 * 3. A shadow map three made keeps only its depth texture (`dropShadowColour`, as Driftwood's E174 maps).
 * 4. Bloom's luminance pass at half resolution and no depth buffer on the composer's output buffer (Game.buildComposer).
 *
 * A context loss reloads the page while it is on (gpuOnly.ts: the released copies cannot be uploaded again).
 */
import * as THREE from 'three';
import { RenderPass, type BloomEffect, type EffectComposer, type Pass } from 'postprocessing';
import { setting } from '../ui/Settings';
import { markGpuOnly } from '../core/gpuOnly';
import type { Renderer } from './renderer';

let on: boolean | null = null;
/** the row, read once per page (a reload row) */
export function memorySaverOn(): boolean {
  on ??= setting('memorySaver') === 'on';
  return on;
}

const LABEL = 'engine/memorySaver';
const isTexture = (value: unknown): value is THREE.Texture => value instanceof THREE.Texture;
const isTarget = (value: unknown): value is THREE.WebGLRenderTarget => value instanceof THREE.WebGLRenderTarget;

// ── textures ──

/** three r186's WebGLTextures.getTextureCacheKey: one GL texture per source and key */
function cacheKey(t: THREE.Texture): string {
  const wrapR: unknown = Reflect.get(t, 'wrapR');
  return [t.wrapS, t.wrapT, typeof wrapR === 'number' ? wrapR : 0, t.magFilter, t.minFilter, t.anisotropy, t.internalFormat ?? 'null', t.format, t.type,
    t.generateMipmaps, t.premultiplyAlpha, t.flipY, t.unpackAlignment, t.colorSpace].map(String).join(',');
}

/** a released source → the key it was uploaded under (another key would need the pixels again) */
const released = new WeakMap<THREE.TextureSource<unknown>, string>();
/** the texture files' sources (assets.ts' loadTexture) → their release hook: only these let go of their image. A GLB's
 *  embedded image stays: shard and kit code reads `map.image` after the upload (Pine Hollow's coat atlases and trophy
 *  mounts, the NPC atlas packer), and canvases and data textures are redrawn */
const bitmapRelease = new WeakMap<THREE.TextureSource<unknown>, () => void>();
let placeholder: THREE.TextureSource<unknown> | null = null;
let warned = false;

/** assets.ts: a texture file's source; `done` runs once it is on the GPU (the image cache lets go of the image) */
export function releaseOnUpload(source: THREE.TextureSource<unknown>, done: () => void): void { bitmapRelease.set(source, done); }

function decodedImage(im: unknown): im is ImageBitmap | HTMLImageElement {
  return (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) || (typeof HTMLImageElement !== 'undefined' && im instanceof HTMLImageElement);
}

/** a texture whose CPU source nothing reads after its upload: a texture file's decoded image */
function releasable(t: THREE.Texture): boolean {
  if (!bitmapRelease.has(t.source) || t.isRenderTargetTexture || t instanceof THREE.VideoTexture || t instanceof THREE.CubeTexture || t instanceof THREE.CanvasTexture ||
    t instanceof THREE.DataTexture || t instanceof THREE.DataArrayTexture || t instanceof THREE.Data3DTexture || t instanceof THREE.CompressedTexture) return false;
  return decodedImage(t.image);
}

/** after the upload: the source keeps its size only, its version is frozen (a same-key clone shares the GL texture, no
 *  re-upload), and assets.ts lets go of the image (closing the bitmap once no other source of the file waits for it) */
function release(t: THREE.Texture): void {
  const source = t.source, im: unknown = source.data;
  if (released.has(source) || !decodedImage(im)) return;
  released.set(source, cacheKey(t));
  source.data = { width: im.width, height: im.height };
  Object.defineProperty(source, 'needsUpdate', { configurable: true, get: () => false, set: () => undefined });
  Object.defineProperty(t, 'needsUpdate', { configurable: true, get: () => false, set: () => undefined }); // a later sampler change keeps the uploaded texture
  bitmapRelease.get(source)?.();
  markGpuOnly(LABEL);
}

/** a texture first seen after its source went: under another key it would upload nothing — it takes a 1×1 stand-in */
function guardReleased(t: THREE.Texture, uploadedKey: string): void {
  if (cacheKey(t) === uploadedKey) return;
  placeholder ??= new THREE.TextureSource(new ImageData(1, 1));
  t.source = placeholder;
  if (!warned) { warned = true; console.warn('[memory saver] a texture asked for a released image under other sampler settings: it draws a 1×1 stand-in', t.name); }
}

function watchTexture(t: THREE.Texture): void {
  const uploadedKey = released.get(t.source);
  if (uploadedKey !== undefined) { guardReleased(t, uploadedKey); return; }
  if (!releasable(t)) return;
  // oxlint-disable-next-line wildshard/no-hook-chain -- three.js's Texture.onUpdate is a third-party one-slot hook; the release runs once, then hands it back
  const prev = t.onUpdate;
  t.onUpdate = (tex: THREE.Texture): void => {
    prev?.(tex);
    t.onUpdate = prev;
    release(tex);
  };
}

// ── geometry ──

/** kept on the CPU: picking and raycasts read positions and the index; skinned bounds read the skin weights */
const KEEP = new Set(['position', 'skinIndex', 'skinWeight']);
/** render calls a geometry must draw unchanged before its arrays go (a geometry still being filled keeps them) */
const SETTLE_RENDERS = 240;

interface Pending { geometry: THREE.BufferGeometry; at: number; versions: number[] }
function versions(g: THREE.BufferGeometry): number[] { return Object.values(g.attributes).map((a) => (a instanceof THREE.BufferAttribute ? a.version : -1)); }
const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

function releaseGeometry(g: THREE.BufferGeometry): void {
  if (g.boundingBox === null) g.computeBoundingBox();
  if (g.boundingSphere === null) g.computeBoundingSphere();
  let bytes = 0;
  for (const [name, a] of Object.entries(g.attributes)) {
    if (KEEP.has(name) || !(a instanceof THREE.BufferAttribute) || a instanceof THREE.InstancedBufferAttribute || a.usage !== THREE.StaticDrawUsage || a.array.length === 0) continue;
    bytes += a.array.byteLength;
    a.array = a.array.slice(0, 0); // uploaded at this version (it drew); the count stays
  }
  if (bytes > 0) markGpuOnly(LABEL);
}

/**
 * The renderer's hooks: every texture is looked at when three first asks for its properties (before its upload), every
 * geometry when it first draws. Off (the row's default) nothing is installed.
 */
export function installMemorySaver(renderer: Renderer): void {
  if (!memorySaverOn()) return;
  const seenTextures = new WeakSet<THREE.Texture>();
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = (object) => {
    if (isTexture(object) && !seenTextures.has(object)) { seenTextures.add(object); watchTexture(object); }
    return get(object);
  };
  const seenGeometry = new WeakSet<THREE.BufferGeometry>();
  const queue: Pending[] = [];
  let head = 0, lastFrame = -1;
  const settle = (frame: number): void => {
    while (head < queue.length) {
      const p = queue[head];
      if (p === undefined || frame - p.at < SETTLE_RENDERS) break;
      head++;
      const now = versions(p.geometry);
      if (same(now, p.versions)) releaseGeometry(p.geometry);
      else queue.push({ geometry: p.geometry, at: frame, versions: now }); // still changing: look again later
    }
    if (head > 256 && head * 2 > queue.length) { queue.splice(0, head); head = 0; }
  };
  const draw = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    draw(camera, scene, geometry, material, object, group);
    const frame = renderer.info.render.frame;
    if (frame !== lastFrame) { lastFrame = frame; settle(frame); }
    if (seenGeometry.has(geometry) || object instanceof THREE.BatchedMesh) return;
    seenGeometry.add(geometry);
    queue.push({ geometry, at: frame, versions: versions(geometry) });
  };
}

// ── shadows and post ──

/** Game's shadow pass: after three made a light's map, its colour texture goes (shadowVariants.ts) */
export function shadowLights(lights: readonly THREE.Light[], drop: (rt: THREE.WebGLRenderTarget) => void): void {
  for (const light of lights) {
    if (!(light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight)) continue;
    const map = light.shadow.map;
    if (isTarget(map) && map.depthTexture !== null) drop(map);
  }
}

/** bloom's luminance (the threshold pass the mip blur reads) at half resolution: −6.6 MB at the phone's frame */
export function halfLuminance(bloom: BloomEffect): void { bloom.luminancePass.resolution.scale = 0.5; }

/**
 * The composer's output buffer loses its depth buffer when no pass draws geometry into it (every pass after the scene
 * pass is full-screen): the scene pass's depth is the only one read. −4.4 MB at the phone's frame. False = kept.
 */
export function dropOutputDepth(composer: EffectComposer, scenePass: Pass): boolean {
  if (composer.passes.some((p) => p !== scenePass && p instanceof RenderPass)) return false;
  const out = composer.outputBuffer;
  out.depthTexture?.dispose();
  out.depthTexture = null;
  out.depthBuffer = false;
  out.dispose();
  return true;
}

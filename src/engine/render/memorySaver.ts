/**
 * SF22d (E435): the Memory saver, pause ▸ Settings ▸ Debug ▸ Loading & memory, a reload. Defaults on in Developer (E451), off publicly. The engine's memory
 * cuts from the Pine Hollow / Driftwood breakdown (docs/design/mmo/research/e435/memory-pine-driftwood.md, `4ec64f071`)
 * that change no look. Saved picks override the Developer default; Developer off fences them off until a phone
 * reading backs the public default (RENDERING.md). Jake’s Developer playtests supply that reading:
 *
 * 1. three.js's CPU copies go once they are on the GPU. A texture file's decoded image (loadTexture's ImageBitmap or
 *    <img>) is let go at its upload (`watchTexture`) and the image cache of `loadImage` lets go of it too (assets.ts);
 *    one source per file, so a file used twice uploads once. A GLB's embedded image, canvases and data textures stay
 *    (code reads or redraws them after the upload; KTX2 textures already drop their mips, ktx2.ts). A static geometry's attributes but `position`,
 *    the skin weights and the index give up their arrays once the geometry has drawn unchanged for a while
 *    (`releaseGeometry`): the full drop (positions and indices too) stalled Driftwood's re-walk, something reads them.
 *    A released array is read back from the GPU the first time any code reads or writes it again (`restore`), and that
 *    attribute then keeps it: a late writer (the far herd's repaint faulted three's same-size check, SF22d) or reader
 *    sees the real bytes. Only static (StaticDrawUsage, no update ranges), plain attributes three uploaded go.
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
import { arrayReleased, markArrayReleased, markArrayRestored } from './releasedArrays';
import type { Renderer } from './renderer';
import { renderCount } from './frameCounter';

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

type ArrayCtor = new (length: number) => THREE.TypedArray;
/** an attribute array three uploaded → the GL buffer it went into (installMemorySaver's bufferData hook) */
const uploadedTo = new WeakMap<ArrayBufferView, WebGLBuffer>();
/** attributes whose array something touched after their release (it came back from the GPU): never released again */
const touched = new WeakSet();
let gl: WebGL2RenderingContext | null = null;
let lostWarned = false;

/**
 * The released array, read back from the GPU the first time anything asks for `attribute.array` again — a writer that
 * repaints it (the far herd's per-member tints, PH-P2), a reader that copies it (the far herd's batch growth reads the
 * rigs' source geometry, `clone`, a raycast's uv): the CPU copy is a plain array again, with the GPU's bytes (the
 * version three uploaded), so the write uploads at the same size and the read sees the real data. A buffer deleted since
 * (its geometry disposed) has nothing to read: it comes back zero-filled at its size, with a warning.
 */
function restore(a: object, buffer: WebGLBuffer, Ctor: ArrayCtor, length: number, name: string): THREE.TypedArray {
  const array = new Ctor(length);
  if (gl?.isBuffer(buffer) === true) {
    gl.bindBuffer(gl.COPY_READ_BUFFER, buffer); // a copy target three never binds: its ARRAY_BUFFER / VAO state stays
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, array);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
  } else if (!lostWarned) {
    lostWarned = true;
    console.warn('[memory saver] a released attribute was read after its geometry was disposed: it comes back zero-filled', name);
  }
  Object.defineProperty(a, 'array', { value: array, writable: true, configurable: true, enumerable: true });
  touched.add(a);
  markArrayRestored(a);
  return array;
}

/** may `a` give up its array: a static, plain (not instanced, not interleaved) attribute three uploaded, untouched since */
function releasableAttribute(name: string, a: unknown): a is THREE.BufferAttribute {
  return !KEEP.has(name) && a instanceof THREE.BufferAttribute && !(a instanceof THREE.InstancedBufferAttribute) && !arrayReleased(a) && !touched.has(a) &&
    a.usage === THREE.StaticDrawUsage && a.updateRanges.length === 0 && a.array.length > 0 && uploadedTo.has(a.array);
}

/**
 * No bounds are computed here: `position` stays, so a box or sphere is computed when something asks, as with the row off.
 * Computing them at release read geometries whose owner had already dropped its arrays (the far herd's view batch: its
 * attributes keep their count over an empty array, gpuOnly-style), so every vertex came back NaN (SF22d).
 */
function releaseGeometry(g: THREE.BufferGeometry, label: string): void {
  let bytes = 0;
  for (const [name, a] of Object.entries(g.attributes)) {
    if (!releasableAttribute(name, a)) continue;
    const array = a.array, buffer = uploadedTo.get(array);
    if (buffer === undefined) continue;
    const Ctor = array.constructor as ArrayCtor, length = array.length, where = `${label}.${name}`;
    bytes += array.byteLength;
    markArrayReleased(a);
    // uploaded at this version (it drew); the count stays. Reading or writing `array` brings it back (restore)
    Object.defineProperty(a, 'array', {
      configurable: true, enumerable: true,
      get: (): THREE.TypedArray => restore(a, buffer, Ctor, length, where),
      set: (value: THREE.TypedArray): void => {
        Object.defineProperty(a, 'array', { value, writable: true, configurable: true, enumerable: true });
        touched.add(a);
        markArrayRestored(a);
      },
    });
  }
  if (bytes > 0) markGpuOnly(LABEL);
}

/** remember which GL buffer each attribute array went into (three's WebGLAttributes.createBuffer / a full re-upload) */
function watchUploads(context: WebGL2RenderingContext): void {
  gl = context;
  const bufferData: unknown = Reflect.get(context, 'bufferData');
  if (typeof bufferData !== 'function') return;
  const watchedBufferData = function watchedBufferData(this: WebGL2RenderingContext, ...args: unknown[]): unknown {
    const result: unknown = Reflect.apply(bufferData, this, args);
    const [target, data] = args;
    if (target === context.ARRAY_BUFFER && ArrayBuffer.isView(data)) {
      const bound: unknown = context.getParameter(context.ARRAY_BUFFER_BINDING);
      if (bound instanceof WebGLBuffer) uploadedTo.set(data, bound);
    }
    return result;
  };
  Object.defineProperty(context, 'bufferData', { value: watchedBufferData, writable: true, configurable: true });
}

/**
 * The renderer's hooks: every texture is looked at when three first asks for its properties (before its upload), every
 * geometry when it first draws. When off (the public default), nothing is installed.
 */
export function installMemorySaver(renderer: Renderer): void {
  if (!memorySaverOn()) return;
  const context = renderer.getContext();
  if (context instanceof WebGL2RenderingContext) watchUploads(context);
  const seenTextures = new WeakSet<THREE.Texture>();
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = (object) => {
    if (isTexture(object) && !seenTextures.has(object)) { seenTextures.add(object); watchTexture(object); }
    return get(object);
  };
  const seenGeometry = new WeakSet<THREE.BufferGeometry>();
  const queue: (Pending & { label: string })[] = [];
  let head = 0, lastFrame = -1;
  const settle = (frame: number): void => {
    while (head < queue.length) {
      const p = queue[head];
      if (p === undefined || frame - p.at < SETTLE_RENDERS) break;
      head++;
      const now = versions(p.geometry);
      if (same(now, p.versions)) releaseGeometry(p.geometry, p.label);
      else queue.push({ geometry: p.geometry, at: frame, versions: now, label: p.label }); // still changing: look again later
    }
    if (head > 256 && head * 2 > queue.length) { queue.splice(0, head); head = 0; }
  };
  const draw = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    draw(camera, scene, geometry, material, object, group);
    const frame = renderCount(renderer); // SF59: the engine's render count, not three's (node draws bump three's)
    if (frame !== lastFrame) { lastFrame = frame; settle(frame); }
    if (seenGeometry.has(geometry) || object instanceof THREE.BatchedMesh) return;
    seenGeometry.add(geometry);
    queue.push({ geometry, at: frame, versions: versions(geometry), label: object.name || geometry.name || object.type });
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

import { pageScope } from '../app/resources';
/**
 * The KTX2 side of the texture loaders (E157, src/engine/boot/gpuFiles.ts says what and why).
 *
 *   initKtx2(renderer)            once the renderer exists (core/assets.ts setAnisotropy): detects the GPU's compressed
 *                                 formats (ASTC · BC7 · ETC2 · S3TC …), less any family the capability probe saw sample
 *                                 wrong when mipmapped (render/ktx2Probe.ts), and starts fetching the Basis transcoder
 *                                 (/basis/r<three>/, copied from three by vite/basis.ts), so it is warm before the first file
 *   ktx2Texture(served)           the KTX2 stand-in of a file the tier fetches, as a CompressedTexture — or null (none, or
 *                                 KTX2 off): the caller then loads the image as before. One transcode per file per wave;
 *                                 Memory saver also shares weak source identity across later waves, without retaining mips
 *   ktx2File(url)                 a KTX2 file at its own URL (a product's named blob), as a CompressedTexture
 *   ktx2Layers(served[], size)    per-file textures for a texture array (the terrain / bark splat), mip-trimmed to `size`
 *
 * glTF: every GLTFLoader gets the loader at parse time (the prototype patch below), so a `.glb` / `.gltf` whose textures
 * are KHR_texture_basisu (tierUrl swaps them in) loads through any of the game's GLTFLoaders unchanged.
 *
 * Orientation: the standalone KTX2 files were Y-flipped at encode, so they sample like the ImageBitmap ('flipY') and
 * TextureLoader (flipY = true) images they replace, with flipY = false (compressed data cannot be flipped at upload);
 * glTF textures keep glTF's own orientation, as before.
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { texMode, gpuFile, standIn } from '../boot/gpuFiles';
import { markGpuOnly } from './gpuOnly';
import { type Renderer, probeRenderer } from '../render/renderer';
import { labelAsset } from '../render/gpuLabels';
import { ScopedWorkerPool } from './scopedWorkerPool';
import { Ktx2Sources } from './ktx2Sources';
import { uploadCompressedTexture } from '../render/compressedUpload';
import { registerCompressedMipmaps, compressedMipmapsUploaded, restoreCompressedMipmaps } from '../render/compressedMipmaps';
import { dispatchRebind } from '../app/scope';
import { harnessPins } from '../app/identity';
import { applyKtx2Probe, ktx2ProbeResult, linearAstcSurvives } from '../render/ktx2Probe';
import { workSlice } from './workSlice';
import { TIER } from './tier';
import { unsupercompressKtx2 } from './ktx2Zstd';
import { parseKtx2 } from '@wildshard/format/ktx2Cost';

/** where vite/basis.ts copies three's transcoder: versioned by three's revision, so the SW / HTTP caches never mix two */
export const BASIS_PATH: Parameters<KTX2Loader['setTranscoderPath']>[0] = `/basis/r${THREE.REVISION}/`;

let loader: KTX2Loader | null = null;
let gameRenderer: Renderer | null = null;

function createLoader(): KTX2Loader {
  const made = new KTX2Loader().setTranscoderPath(BASIS_PATH);
  // Basis workers retain separate Wasm heaps; phone reads stay parallel, transcodes do not.
  made.workerPool = new ScopedWorkerPool(pageScope, TIER === 'phone' ? 1 : 4);
  return offThreadZstd(made);
}
const zstdWrapped = new WeakSet<KTX2Loader>();
/** G639 frame floor: a raw-texel zstd file's levels decode in a worker first (ktx2Zstd.ts), not in three's parse on the
 *  page's thread. Every loader the engine makes or configures (`detectKtx2Support`) takes it once; an unready loader still
 *  throws at once, as three's own parse does. */
function offThreadZstd(made: KTX2Loader): KTX2Loader {
  if (zstdWrapped.has(made)) return made;
  zstdWrapped.add(made);
  const parse = made.parse.bind(made);
  made.parse = (buffer, onLoad, onError): void => {
    if (made.workerConfig === null) { parse(buffer, onLoad, onError); return; }
    const run = async (): Promise<void> => {
      const plain = await unsupercompressKtx2(buffer);
      try { parse(plain, onLoad, onError); } catch (error: unknown) { if (onError !== undefined) onError(error); else throw error; }
    };
    void run();
  };
  return made;
}
/**
 * The GPU's formats, less every family the capability probe saw sample wrong when mipmapped (render/ktx2Probe.ts).
 * On a page whose probe a measurement pin skipped, its textures also come back RGB-ETC2-free (`widenRgbEtc2`).
 */
export function detectKtx2Support(made: KTX2Loader, renderer: Renderer): KTX2Loader {
  made.detectSupport(renderer);
  offThreadZstd(made);
  applyKtx2Probe(made.workerConfig);
  if (harnessPins()?.ktx2Probe === 'skip') {
    const parse = made.parse.bind(made);
    made.parse = (buffer, onLoad, onError): void => {
      parse(buffer, onLoad === undefined ? undefined : (texture) => {
        const publish = async (): Promise<void> => {
          try { onLoad(await widenRgbEtc2Async(texture)); }
          catch (error) {
            if (onError !== undefined) onError(new ErrorEvent('error', { error, message: String(error) }));
            else queueMicrotask(() => { throw error; });
          }
        };
        void publish();
      }, onError);
    };
  }
  return made;
}

/** an EAC alpha block that decodes to 255 everywhere: base 255, multiplier 0 */
const OPAQUE_EAC = Uint8Array.of(0xff, 0, 0, 0, 0, 0, 0, 0);

/**
 * RGB8 ETC2 → RGBA8 ETC2/EAC, pixel for pixel (OM, 2026-10-17): each 8-byte colour block gets an opaque 8-byte EAC
 * alpha block in front of it, and RGBA8 ETC2/EAC decodes its colour half exactly as RGB8 ETC2 does. The iOS Simulator's
 * WebKit GPU process (ANGLE's Metal UploadTextureContents) reads past the end of an RGB8 ETC2 compressedTexSubImage2D/3D
 * payload and crashes ("the GPU process restarted"), deterministically in isolation. The KTX2 probe turns ETC2 off
 * there, so only a page whose probe the G386 measurement pin skipped transcodes opaque ETC1S to RGB8 ETC2; it widens
 * those textures instead (twice their bytes) and uploads safely. Any other texture comes back unchanged.
 */
function* widenRgbEtc2Steps(texture: THREE.CompressedTexture): Generator<undefined, THREE.CompressedTexture, void> {
  if (texture.format !== THREE.RGB_ETC2_Format || texture instanceof THREE.CompressedCubeTexture) return texture;
  const mipmaps: THREE.CompressedTexture['mipmaps'] = [];
  for (const mip of texture.mipmaps) {
    const src = new Uint8Array(mip.data.buffer, mip.data.byteOffset, mip.data.byteLength);
    const out = new Uint8Array(src.byteLength * 2);
    for (let start = 0; start < src.byteLength; start += 32768) {
      yield;
      for (let offset = start; offset < Math.min(start + 32768, src.byteLength); offset += 8) {
        out.set(OPAQUE_EAC, offset * 2);
        out.set(src.subarray(offset, offset + 8), offset * 2 + 8);
      }
    }
    mipmaps.push({ data: out, width: mip.width, height: mip.height });
  }
  texture.mipmaps = mipmaps;
  texture.format = THREE.RGBA_ETC2_EAC_Format;
  texture.needsUpdate = true;
  return texture;
}

/** Renderer-free synchronous conversion for bake callers; runtime texture callbacks use the paced form below. */
export function widenRgbEtc2(texture: THREE.CompressedTexture): THREE.CompressedTexture {
  const steps = widenRgbEtc2Steps(texture);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

const wideningEtc2 = new WeakMap<THREE.CompressedTexture, Promise<THREE.CompressedTexture>>();
/** Exact ETC2 widening in bounded batches under the shared frame budget; concurrent readers share complete mips. */
export async function widenRgbEtc2Async(texture: THREE.CompressedTexture): Promise<THREE.CompressedTexture> {
  const shared = wideningEtc2.get(texture); if (shared !== undefined) return shared;
  const convert = async (): Promise<THREE.CompressedTexture> => {
    const steps = widenRgbEtc2Steps(texture), slice = workSlice(undefined, pageScope);
    for (;;) {
      await slice.check();
      const step = steps.next();
      if (step.done) return step.value;
    }
  };
  const pending = convert(); wideningEtc2.set(texture, pending);
  try { return await pending; } finally { wideningEtc2.delete(texture); }
}

/** The same probe-filtered capabilities used by the actual transcoder; before a renderer, retain RGBA charging. */
export function ktx2TranscodeSupport(renderer: Renderer | null = gameRenderer): { astc: boolean; bc7: boolean } {
  if (renderer === null) return { astc: false, bc7: false };
  const made = detectKtx2Support(new KTX2Loader(), renderer);
  try { return { astc: made.workerConfig.astcSupported, bc7: made.workerConfig.bptcSupported }; }
  finally { made.dispose(); }
}

/** detect the GPU's formats and start the transcoder download (idempotent) */
export function initKtx2(renderer: Renderer): void {
  gameRenderer ??= renderer; // the building shard's (a slot: each resident shard has its own, below)
  if (texMode() !== 'ktx2') return;
  markGpuOnly('KTX2 textures (their mips are dropped from JS once uploaded)'); // this build's (a shard built with images restores in place)
  if (loader !== null) return; // the formats are the GPU's: one loader for every KTX2 build
  loader = detectKtx2Support(createLoader(), renderer);
  loader.init().catch((e: unknown) => { console.warn('[ktx2] transcoder failed to load', e); });
}

/** a loader even without the game's renderer (dev pages, a model loaded before the renderer): detect on a throw-away context */
function ktx2Loader(): KTX2Loader {
  if (loader !== null) return loader;
  const probe = probeRenderer();
  try {
    const made = detectKtx2Support(createLoader(), probe);
    loader = made;
    return made;
  } finally { probe.dispose(); probe.forceContextLoss(); }
}

/** Fence a finalized compressed texture before publishing it to a material or doing a readback.
 * Set its colour space, sampler and version first. Raw KTX2 layer inputs stay unuploaded until assembled.
 * A loader whose consumer still configures its sampler passes final=false to keep its CPU mip chain.
 * Node/bake callers without a game renderer retain their existing renderer-free path. */
export async function prepareCompressedTexture<T extends THREE.Texture>(texture: T, renderer: Renderer | null = gameRenderer,
  current: () => boolean = () => true, final = true): Promise<T> {
  if (renderer !== null) await uploadCompressedTexture(renderer, texture, current, final);
  return texture;
}

/**
 * Once a compressed texture is on the GPU its transcoded mips are dead weight in the JS heap (about as big again as the
 * GPU copy: +85–130 MB on Pine Hollow's phone boot before this): drop the texture's own reference after its upload.
 * Clones share the mip data, so it is freed when the last of them has uploaded. An in-place WebGL restore could not
 * re-upload it, so a context loss reloads the page instead (gpuOnly.ts, GpuRecovery.ts — as iOS's GPU-process loss already does).
 */
export function releaseAfterUpload<T extends THREE.CompressedTexture>(t: T): T {
  registerCompressedMipmaps(t);
  t.onUpdate = (): void => { compressedMipmapsUploaded(t); };
  return t;
}

// every GLTFLoader the game makes (a dozen modules each own one): hand it the KTX2 loader when it parses, so the
// KHR_texture_basisu models tierUrl swaps in load wherever they are asked for; their textures drop their mips once uploaded.
// Install at the original loader construction; mode is sampled only at parse time.
const configuredGltfLoaders = new WeakSet<typeof GLTFLoader>();
/** Configure the original concrete constructor once, without replacing it.
 * The texture owner need not import the parser on pages that never load a GLTF. */
export function installGltfKtx2(type: typeof GLTFLoader): void {
  if (configuredGltfLoaders.has(type)) return;
  const parse: unknown = Object.getOwnPropertyDescriptor(type.prototype, 'parse')?.value;
  if (typeof parse === 'function') {
    Object.defineProperty(type.prototype, 'parse', {
      configurable: true, writable: true,
      value(this: GLTFLoader, ...args: Parameters<GLTFLoader['parse']>): void {
        if (texMode() !== 'ktx2') { Reflect.apply(parse, this, args); return; }
        if (this.ktx2Loader === null) this.setKTX2Loader(ktx2Loader());
        const [data, path, onLoad, onError] = args;
        const release = (gltf: Parameters<typeof onLoad>[0]): void => {
          const textures = new Set<THREE.Texture>();
          gltf.scene.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const mats: unknown[] = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m instanceof THREE.Material) for (const v of Object.values(m)) if (v instanceof THREE.CompressedTexture) { releaseAfterUpload(v); textures.add(v); }
          });
          const publish = async (): Promise<void> => {
            try {
              // glTF consumers still choose their final sampler (e.g. a viewmodel's anisotropy).
              await Promise.all([...textures].map(texture => prepareCompressedTexture(texture, gameRenderer, () => true, false)));
              onLoad(gltf);
            } catch (error) {
              if (onError !== undefined) onError(new ErrorEvent('error', { error, message: String(error) }));
              else queueMicrotask(() => { throw error; });
            }
          };
          void publish();
        };
        Reflect.apply(parse, this, [data, path, release, onError]);
      },
    });
    configuredGltfLoaders.add(type);
  }
}

/**
 * One transcode per file for the requests of one wave (loadPBR's three maps, the cabins' shared sets): the entry is
 * dropped a task after it lands, so the mips can be freed once its clones have uploaded — a later ask transcodes again.
 */
const transcoded = new Map<string, Promise<THREE.CompressedTexture>>();
const sources = new Ktx2Sources();
/** each file-backed texture's file, its first mip and a copy of its last (a few bytes), for the T6.2 lease */
const files = new WeakMap<THREE.Texture, { readonly url: string; readonly level: number; readonly tail: THREE.CompressedTextureMipmap | undefined }>();
const fileOf = (texture: THREE.CompressedTexture, url: string, level: number): void => {
  const last = texture.mipmaps.at(-1);
  files.set(texture, { url, level, tail: last === undefined ? undefined : { data: last.data.slice(), width: last.width, height: last.height } });
};
function load(url: string, keep: boolean): Promise<THREE.CompressedTexture> {
  let p = transcoded.get(url);
  if (p === undefined) {
    p = ktx2Loader().loadAsync(url);
    if (keep) {
      transcoded.set(url, p);
      p.finally(() => { pageScope.timeout(0, () => { transcoded.delete(url); }); }).catch(() => undefined);
    }
  }
  return p;
}

/**
 * A KTX2 file at its own URL (a shardfile product's named blob, not the stand-in of another file) as a CompressedTexture
 * on the page's loader, in any texture mode: one transcode per file per wave, flipY = false (the file keeps its encoded
 * orientation), its mips dropped from JS once uploaded. The caller sets its sampler and colour space, then fences it with
 * `prepareCompressedTexture`.
 */
export async function ktx2File(url: string): Promise<THREE.CompressedTexture> {
  if (texMode() !== 'ktx2') markGpuOnly('KTX2 product files on the image path (their mips are dropped from JS once uploaded)');
  const t = (await load(url, true)).clone();
  t.flipY = false;
  t.generateMipmaps = false;
  sources.share(t, url, 0);
  fileOf(t, url, 0);
  return labelAsset(releaseAfterUpload(t), 'engine/ktx2File', url);
}

/** Parse bounded borrowed KTX2 bytes on the configured loader, including its off-thread Zstd path.
 * Copies the selected view before decoding; performs no URL read. The caller owns the returned texture,
 * sets its sampler/colour space, and applies its existing upload/release policy. */
export function parseKtx2Bytes(input: Uint8Array): Promise<THREE.Texture> {
  if (!(input.buffer instanceof ArrayBuffer)) throw new Error('KTX2 bytes require an owned buffer');
  parseKtx2(input);
  const bytes = Uint8Array.from(input);
  return new Promise<THREE.Texture>((resolve, reject) => {
    ktx2Loader().parse(bytes.buffer, texture => { texture.flipY = false; resolve(texture); }, reject);
  });
}

/**
 * The KTX2 texture standing in for `served`, or null: load the image instead. Memory saver keeps a bounded weak
 * source identity across transcode waves: equal file/mip/format and sampler share a GPU allocation. Fresh mips
 * remain on every returned texture until upload, including after disposal or for a different sampler.
 * `maxSize` (the tier's texture cap, as loadImage applies it to a decode): a larger file starts at the first mip that fits.
 */
export async function ktx2Texture(served: string, maxSize: typeof Infinity = Infinity): Promise<THREE.CompressedTexture | null> {
  const url = gpuFile(served);
  if (url === undefined) return null;
  const base = await load(url, true);
  const skip = base.mipmaps.findIndex((m) => Math.max(m.width, m.height) <= maxSize);
  let t: THREE.CompressedTexture;
  if (skip > 0) { // its own source: the trimmed chain is another upload
    const mips = base.mipmaps.slice(skip), m0 = mips[0];
    if (!m0) return null;
    t = new THREE.CompressedTexture(mips, m0.width, m0.height, base.format, base.type);
    t.minFilter = base.minFilter; t.magFilter = base.magFilter; t.colorSpace = base.colorSpace;
  } else {
    t = base.clone();
  }
  t.flipY = false;
  t.generateMipmaps = false;
  sources.share(t, url, Math.max(0, skip));
  fileOf(t, url, Math.max(0, skip));
  return labelAsset(releaseAfterUpload(t), 'engine/ktx2Texture', url);
}

/**
 * Tile streaming T6.2's texture lease: a KTX2 texture loaded from its own file (`ktx2File` / `ktx2Texture`) can give its
 * GPU storage back while every owner keeps the texture (a binding-only dispose, `dispatchRebind`), and take it again
 * later from the same file into the same texture, so materials, clones and batches that hold it need no rebinding.
 *
 *   leaseOutKtx2(texture)          → true: storage freed (false: not a file-backed KTX2 texture, or already out)
 *   await leaseInKtx2(texture)     re-transcodes the file's mips into it and uploads them before resolving
 *
 * Between the two the caller hides what reads it: the texture holds only its last mip (a stray draw samples that).
 */
const leased = new WeakMap<THREE.Texture, Promise<void> | null>();
export function leaseOutKtx2(texture: THREE.Texture): boolean {
  const file = files.get(texture);
  if (file?.tail === undefined || leased.has(texture) || !(texture instanceof THREE.CompressedTexture)) return false;
  leased.set(texture, null);
  dispatchRebind(texture);
  // until the lease ends it holds only its chain's last mip (a texture never drawn held all of them): a stray upload (a
  // warm-up's stand-in of a hidden rig) takes a few bytes, never an empty chain
  restoreCompressedMipmaps(texture);
  ownSource(texture);
  texture.mipmaps = [file.tail];
  texture.needsUpdate = true;
  return true;
}
/** A fresh source of its own: three allocates its storage anew at the next upload (a stray upload made the placeholder's
 *  storage one level deep), and no texture sharing the old one uploads again. */
function ownSource(texture: THREE.Texture): void {
  const image: unknown = texture.source.data;
  texture.source = new THREE.Texture(image).source;
}
/** Whether `texture` is leased out (or still being taken back). */
export function ktx2Leased(texture: THREE.Texture): boolean { return leased.has(texture); }
export function leaseInKtx2(texture: THREE.Texture): Promise<void> {
  const file = files.get(texture), pending = leased.get(texture);
  if (pending !== null && pending !== undefined) return pending;
  if (file === undefined || pending === undefined || !(texture instanceof THREE.CompressedTexture)) return Promise.resolve();
  const back = (async (): Promise<void> => {
    const fresh = await load(file.url, true), mips = fresh.mipmaps.slice(file.level);
    if (mips.length === 0 || fresh.format !== texture.format) throw new Error(`KTX2 lease of ${file.url}: the file no longer matches its texture`);
    restoreCompressedMipmaps(texture);
    ownSource(texture);
    texture.mipmaps = mips;
    texture.needsUpdate = true;
    await prepareCompressedTexture(texture);
    leased.delete(texture);
  })();
  leased.set(texture, back);
  back.catch(() => { leased.set(texture, null); });
  return back;
}

/**
 * The image fallback's one compressed exception (E435 img-fallback): on a page the capability probe turned to images
 * because sRGB ASTC / ETC2 mips read as zeros (the iOS Simulator), linear ASTC 4×4 still samples right, so a LINEAR UASTC
 * file (a tangent-space normal map, a lightmap, the cloud field: bake-ktx2's `normal` / `linear` classes) keeps its KTX2
 * stand-in — the same file and look as the KTX2 path, 1 byte a texel instead of the image's 4 (Pine Hollow's phone
 * normal maps: ~110 MB of RGBA8). Its own loader with ASTC on (the page's loader has the whole family off); anything
 * that does not come back as linear ASTC (an sRGB or ETC1S file) is dropped and the caller loads the image. Null on every
 * other page: the KTX2 path and the plain images path are unchanged.
 */
const LINEAR_NAME = /(^|[_\-.])(nor|nor_gl|normal|nrm|lm|clouds)([_\-.]|$)/;
let linearLoader: KTX2Loader | null = null;
const linearTranscoded = new Map<string, Promise<THREE.CompressedTexture>>();
function linearKtx2Loader(): KTX2Loader {
  if (linearLoader !== null) return linearLoader;
  const made = createLoader(), renderer = gameRenderer ?? probeRenderer();
  try { made.detectSupport(renderer); } finally { if (renderer !== gameRenderer) { renderer.dispose(); renderer.forceContextLoss(); } }
  applyKtx2Probe(made.workerConfig);
  made.workerConfig.astcSupported = true; // linear ASTC passed the probe; only sRGB ASTC failed
  linearLoader = made;
  return made;
}
export async function linearKtx2Texture(served: string, maxSize: typeof Infinity = Infinity): Promise<THREE.CompressedTexture | null> {
  if (texMode() !== 'img' || !linearAstcSurvives(ktx2ProbeResult())) return null;
  if (!LINEAR_NAME.test(served.slice(served.lastIndexOf('/') + 1).toLowerCase())) return null;
  const url = standIn(served, 'ktx2');
  if (url === undefined) return null;
  let p = linearTranscoded.get(url);
  if (p === undefined) {
    p = linearKtx2Loader().loadAsync(url);
    linearTranscoded.set(url, p);
    p.finally(() => { pageScope.timeout(0, () => { linearTranscoded.delete(url); }); }).catch(() => undefined);
  }
  let base: THREE.CompressedTexture;
  try { base = await p; } catch { return null; }
  if (base.format !== THREE.RGBA_ASTC_4x4_Format || base.colorSpace === THREE.SRGBColorSpace) return null;
  markGpuOnly('KTX2 linear textures on the image fallback (their mips are dropped from JS once uploaded)');
  const skip = base.mipmaps.findIndex((m) => Math.max(m.width, m.height) <= maxSize);
  let t: THREE.CompressedTexture;
  if (skip > 0) {
    const mips = base.mipmaps.slice(skip), m0 = mips[0];
    if (!m0) return null;
    t = new THREE.CompressedTexture(mips, m0.width, m0.height, base.format, base.type);
    t.minFilter = base.minFilter; t.magFilter = base.magFilter; t.colorSpace = base.colorSpace;
  } else {
    t = base.clone();
  }
  t.flipY = false;
  t.generateMipmaps = false;
  sources.share(t, url, Math.max(0, skip));
  return labelAsset(releaseAfterUpload(t), 'engine/linearKtx2Texture', url);
}

/**
 * The files of one texture array as KTX2 textures of one format (their `#layer` twins, baked unflipped), their mip chains trimmed so level 0 is `size` (the
 * phone's 512² bark layers are the 1024² files' second level — what the image path downscaled to); null when any file
 * has no stand-in, or the files disagree on format / size: the caller builds the array from images as before.
 */
export async function ktx2Layers(served: readonly string[], size: number): Promise<{ n: number; format: THREE.CompressedPixelFormat; mipmaps: THREE.CompressedTextureMipmap[] } | null> {
  const urls = served.map((s) => gpuFile(`${s}#layer`)); // the unflipped twins: an array layer keeps the file's orientation
  if (urls.some((u) => u === undefined)) return null;
  const layers = await Promise.all(urls.map((u) => (u === undefined ? Promise.resolve(null) : load(u, false))));
  return layerArrayMips(layers, size);
}

/**
 * Concatenate same-format compressed layers into one array texture's mip chain (E157): each layer's chain from its level
 * of edge `min(size, the largest layer)` down, as deep as the shallowest chain. Null when a layer is missing, has another
 * format or lacks that level. Pure: the terrain arrays above and the shardfile client's transcoded splat layers
 * (SHARD-PLATFORM G227) both build their `CompressedArrayTexture` from it.
 */
export function layerArrayMips(layers: readonly ({ readonly format: THREE.CompressedPixelFormat; readonly mipmaps: readonly THREE.CompressedTextureMipmap[]; readonly image: { readonly width: number } } | null)[], size: number): { n: number; format: THREE.CompressedPixelFormat; mipmaps: THREE.CompressedTextureMipmap[] } | null {
  const first = layers[0];
  if (!first) return null;
  const n = Math.min(size, Math.max(...layers.map((l) => l?.image.width ?? 0)));
  const chains: THREE.CompressedTextureMipmap[][] = [];
  for (const l of layers) {
    if (!l || l.format !== first.format) return null;
    const start = l.mipmaps.findIndex((m) => m.width === n && m.height === n);
    if (start === -1) return null;
    chains.push(l.mipmaps.slice(start));
  }
  const levels = Math.min(...chains.map((c) => c.length));
  const mipmaps: THREE.CompressedTextureMipmap[] = [];
  for (let i = 0; i < levels; i++) {
    const parts = chains.map((c) => c[i]);
    let bytes = 0;
    for (const m of parts) bytes += m?.data.byteLength ?? 0;
    const data = new Uint8Array(bytes);
    let at = 0;
    for (const m of parts) { if (!m) return null; data.set(new Uint8Array(m.data.buffer, m.data.byteOffset, m.data.byteLength), at); at += m.data.byteLength; }
    const m0 = parts[0];
    if (!m0) return null;
    mipmaps.push({ data, width: m0.width, height: m0.height });
  }
  return { n, format: first.format, mipmaps };
}

/**
 * Pixels of a texture read back through the GPU (a compressed texture has no image to draw on a canvas): drawn to a w×h
 * sRGB target, rows top-first like a canvas's getImageData; null without a renderer. Nalati's sky reads its zenith colour
 * this way, the painted horizon its floor.
 */
export function readTexturePixels(tex: THREE.Texture, w: number, h: number, renderer: Renderer | null = gameRenderer): Uint8Array | null {
  if (renderer === null) return null;
  const read = drawForRead(tex, w, h, renderer);
  try { renderer.readRenderTargetPixels(read.rt, 0, 0, w, h, read.out); } finally { read.dispose(); }
  return topRowsFirst(read.out, w, h);
}

/**
 * `readTexturePixels` without the stall: the read waits on a GPU fence instead of the main thread. A synchronous read
 * waits for every draw queued before it: on a software GPU (CI's SwiftShader) the painted horizon's floor read held the
 * Explorer's Pine page for 7-9 s behind the frames still rasterizing.
 */
export async function readTexturePixelsAsync(tex: THREE.Texture, w: number, h: number, renderer: Renderer | null = gameRenderer): Promise<Uint8Array | null> {
  if (renderer === null) return null;
  const read = drawForRead(tex, w, h, renderer);
  try { await renderer.readRenderTargetPixelsAsync(read.rt, 0, 0, w, h, read.out); } finally { read.dispose(); }
  return topRowsFirst(read.out, w, h);
}

/** `tex` drawn to a w×h sRGB target (the render target and its scene are disposed with `dispose`) */
function drawForRead(tex: THREE.Texture, w: number, h: number, renderer: Renderer): { readonly rt: THREE.WebGLRenderTarget; readonly out: Uint8Array; readonly dispose: () => void } {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  const out = new Uint8Array(w * h * 4);
  const dispose = (): void => { rt.dispose(); mat.dispose(); quad.geometry.dispose(); };
  try {
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
  } catch (error) { dispose(); throw error; } finally {
    renderer.setRenderTarget(prev);
  }
  return { rt, out, dispose };
}

/** GL rows run bottom-up; with flipY-false data a plane's top row (uv v = 1) is the image's top */
function topRowsFirst(out: Uint8Array, w: number, h: number): Uint8Array {
  const rows = new Uint8Array(out.length), stride = w * 4;
  for (let y = 0; y < h; y++) rows.set(out.subarray((h - 1 - y) * stride, (h - y) * stride), y * stride);
  return rows;
}

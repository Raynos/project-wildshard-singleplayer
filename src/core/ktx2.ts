/**
 * The KTX2 side of the texture loaders (E157, src/boot/gpuFiles.ts says what and why).
 *
 *   initKtx2(renderer)            once the renderer exists (core/assets.ts setAnisotropy): detects the GPU's compressed
 *                                 formats (ASTC · BC7 · ETC2 · S3TC …) and starts fetching the Basis transcoder
 *                                 (/basis/r<three>/, copied from three by vite/basis.ts), so it is warm before the first file
 *   ktx2Texture(served)           the KTX2 stand-in of a file the tier fetches, as a CompressedTexture — or null (none, or
 *                                 KTX2 off): the caller then loads the image as before. One transcode per file; each call
 *                                 gets a clone that SHARES its source, so the same file used twice is one GPU upload
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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TEX_MODE, gpuFile } from '../boot/gpuFiles';

/** where vite/basis.ts copies three's transcoder: versioned by three's revision, so the SW / HTTP caches never mix two */
export const BASIS_PATH = `/basis/r${THREE.REVISION}/`;

let loader: KTX2Loader | null = null;

/** detect the GPU's formats and start the transcoder download (idempotent) */
export function initKtx2(renderer: THREE.WebGLRenderer): void {
  if (loader !== null || TEX_MODE !== 'ktx2') return;
  loader = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
  loader.init().catch((e: unknown) => { console.warn('[ktx2] transcoder failed to load', e); });
}

/** a loader even without the game's renderer (dev pages, a model loaded before the renderer): detect on a throw-away context */
function ktx2Loader(): KTX2Loader {
  if (loader !== null) return loader;
  const probe = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
  try {
    const made = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(probe);
    loader = made;
    return made;
  } finally { probe.dispose(); probe.forceContextLoss(); }
}

// every GLTFLoader the game makes (a dozen modules each own one): hand it the KTX2 loader when it parses, so the
// KHR_texture_basisu models tierUrl swaps in load wherever they are asked for
if (TEX_MODE === 'ktx2') {
  const parse: unknown = Object.getOwnPropertyDescriptor(GLTFLoader.prototype, 'parse')?.value;
  if (typeof parse === 'function') {
    Object.defineProperty(GLTFLoader.prototype, 'parse', {
      configurable: true, writable: true,
      value(this: GLTFLoader, ...args: Parameters<GLTFLoader['parse']>): void {
        if (this.ktx2Loader === null) this.setKTX2Loader(ktx2Loader());
        Reflect.apply(parse, this, args);
      },
    });
  }
}

const transcoded = new Map<string, Promise<THREE.CompressedTexture>>();
function load(url: string, keep: boolean): Promise<THREE.CompressedTexture> {
  let p = transcoded.get(url);
  if (p === undefined) {
    p = ktx2Loader().loadAsync(url);
    if (keep) transcoded.set(url, p);
  }
  return p;
}

/**
 * The KTX2 texture standing in for `served` (a clone sharing one source per file), or null: load the image instead.
 * `maxSize` (the tier's texture cap, as loadImage applies it to a decode): a larger file starts at the first mip that fits.
 */
export async function ktx2Texture(served: string, maxSize = Infinity): Promise<THREE.CompressedTexture | null> {
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
  return t;
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
 * sRGB target, rows top-first like a canvas's getImageData. Nalati's sky reads its zenith colour this way.
 */
export function readTexturePixels(renderer: THREE.WebGLRenderer, tex: THREE.Texture, w: number, h: number): Uint8Array {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  const out = new Uint8Array(w * h * 4);
  try {
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, out);
  } finally {
    renderer.setRenderTarget(prev);
    rt.dispose(); mat.dispose(); quad.geometry.dispose();
  }
  // GL rows run bottom-up; with flipY-false data a plane's top row (uv v = 1) is the image's top
  const rows = new Uint8Array(out.length), stride = w * 4;
  for (let y = 0; y < h; y++) rows.set(out.subarray((h - 1 - y) * stride, (h - y) * stride), y * stride);
  return rows;
}

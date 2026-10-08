import { publicBytes } from '../boot/tables';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { fetchImage, tierUrl } from '../boot/bytes';
import { initKtx2, ktx2Layers, ktx2Texture, releaseAfterUpload } from './ktx2';
import { TIER_CONFIG } from './tier';
import type { Renderer } from '../render/renderer';
import { labelAsset, labelObjectTree } from '../render/gpuLabels';
import { memorySaverOn, releaseOnUpload } from '../render/memorySaver';

const gltfLoader = new GLTFLoader();
const hdrLoader = new HDRLoader();

export interface PBRSet { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }

let maxAniso = 8;
let gpu: Renderer | null = null;
export function setAnisotropy(renderer: Renderer): void { gpu = renderer; maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy()); initKtx2(renderer); }

/**
 * Decoded images, one per URL: the same file asked for twice (rock_ground: terrain slab and cabin
 * rubble) is fetched and decoded once. Decoding goes through fetch → createImageBitmap (off the main
 * thread, bytes counted by the boot plan) and is capped at the tier's texture size — on a phone a
 * 2048² Poly Haven set becomes 1024², a quarter of the GPU memory and upload time.
 */
const images = new Map<string, Promise<ImageBitmap | HTMLImageElement>>();
/** the decode cache's key: a decode below the tier's own cap (a level's memory trim) is another image */
const imageKey = (url: string, maxSize: number): string => (maxSize === TIER_CONFIG.maxTexture ? url : `${url}@${maxSize}`);
export function loadImage(url: string, maxSize = TIER_CONFIG.maxTexture): Promise<ImageBitmap | HTMLImageElement> {
  const key = imageKey(url, maxSize);
  let p = images.get(key);
  if (!p) { p = fetchImage(url, maxSize); images.set(key, p); }
  return p;
}

/**
 * SF22d, the Memory saver (render/memorySaver.ts): every texture of one file and colour space shares one source, so three
 * uploads it once (rock_ground's terrain slab and cabin rubble were two GL textures) and the decoded image goes once that
 * source is on the GPU: the cache lets go of it when the last source made from it has uploaded (a later ask decodes again).
 */
const sharedSources = new Map<string, { source: THREE.TextureSource<unknown>; flipY: boolean }>();
const imageUsers = new Map<string, number>();
const sourceKey = (url: string, srgb: boolean): string => `${url}|${srgb ? 'srgb' : 'linear'}`;
function shareSource(t: THREE.Texture, url: string, srgb: boolean, image: ImageBitmap | HTMLImageElement): void {
  const key = sourceKey(url, srgb), source = t.source;
  sharedSources.set(key, { source, flipY: t.flipY });
  imageUsers.set(url, (imageUsers.get(url) ?? 0) + 1);
  const done = (): void => {
    if (sharedSources.get(key)?.source === source) sharedSources.delete(key);
    const left = (imageUsers.get(url) ?? 1) - 1;
    if (left > 0) { imageUsers.set(url, left); return; }
    imageUsers.delete(url);
    images.delete(url);
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  };
  releaseOnUpload(t.source, done);
}

/**
 * One texture file. `maxSize` (default: the tier's cap) is the largest edge it keeps: a level's own memory trim may ask
 * for less (Pine Hollow's 512² building sets, G180); a KTX2 stand-in drops its top mips, an image decodes smaller.
 */
export async function loadTexture(url: string, srgb = false, repeat = 1, maxSize = TIER_CONFIG.maxTexture): Promise<THREE.Texture> {
  const k = await ktx2Texture(tierUrl(url), maxSize); // E157: the KTX2 stand-in, when the build has one and KTX2 is on (src/engine/core/ktx2.ts)
  if (k) {
    k.wrapS = k.wrapT = THREE.RepeatWrapping;
    k.repeat.set(repeat, repeat);
    k.anisotropy = maxAniso;
    k.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    k.needsUpdate = true;
    return labelAsset(k, 'engine/loadTexture', url);
  }
  const key = imageKey(url, maxSize);
  const shared = memorySaverOn() ? sharedSources.get(sourceKey(key, srgb)) : undefined;
  let t: THREE.Texture;
  if (shared === undefined) {
    const image = await loadImage(url, maxSize);
    t = new THREE.Texture(image);
    t.flipY = !(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap); // bitmaps are flipped at decode
    if (memorySaverOn()) shareSource(t, key, srgb, image);
  } else {
    t = new THREE.Texture();
    t.source = shared.source;
    t.flipY = shared.flipY;
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return labelAsset(t, 'engine/loadTexture', url);
}

/**
 * URL of one map of a Poly Haven set. The phone tier gets the `_1k.jpg` sibling
 * (scripts/tex-tiers.mjs: ≤ 1024², q82 — a quarter of the bytes) when the build has one.
 */
export function texUrl(id: string, kind: 'diffuse' | 'nor_gl' | 'arm'): string {
  const base = `/assets/tex/${id}/${kind}`;
  if (TIER_CONFIG.maxTexture <= 1024 && `${base}_1k.jpg` in publicBytes()) return `${base}_1k.jpg`;
  return `${base}.jpg`;
}
export const pbrUrls = (id: string): string[] => (['diffuse', 'nor_gl', 'arm'] as const).map((k) => texUrl(id, k));

/** Poly Haven texture set: diffuse + GL normal + ARM (ao / roughness / metal). Textures are shared per url; `repeat` is per
 *  call; `maxSize` as loadTexture's (a level's memory trim). */
export async function loadPBR(id: string, repeat = 1, maxSize = TIER_CONFIG.maxTexture): Promise<PBRSet> {
  const [map, normalMap, armMap] = await Promise.all([
    loadTexture(texUrl(id, 'diffuse'), true, repeat, maxSize),
    loadTexture(texUrl(id, 'nor_gl'), false, repeat, maxSize),
    loadTexture(texUrl(id, 'arm'), false, repeat, maxSize),
  ]);
  return { map, normalMap, armMap };
}

export function pbrMaterial(set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap,
    aoMap: set.armMap, roughnessMap: set.armMap, metalnessMap: set.armMap,
    metalness: 1, roughness: 1, ...extra,
  });
}

export function loadGLTF(id: string): Promise<GLTF> {
  const url = `/assets/models/${id}/${id}.gltf`;
  return new Promise((resolve, reject) => { gltfLoader.load(url, (gltf) => { labelObjectTree(gltf.scene, 'engine/loadGLTF', url); resolve(gltf); }, undefined, reject); });
}

export function loadHDR(url: string): Promise<THREE.DataTexture> {
  return new Promise((resolve, reject) => { hdrLoader.load(url, (texture) => { resolve(labelAsset(texture, 'engine/loadHDR', url)); }, undefined, reject); });
}

/**
 * Load several Poly Haven sets into three DataArrayTextures (diffuse / normal / ARM), one layer
 * per id — lets a splat shader use 3 samplers instead of 3×N (WebGL caps fragment samplers at 16).
 *
 * Each decoded bitmap is copied straight into its layer on the GPU (`copyTextureToTexture` →
 * texSubImage3D): no canvas, no `getImageData` readback — 12 × 4 MB of main-thread pixel copies
 * were most of the phone's terrain step. The array is allocated empty (`dataReady = false`) and
 * mipmapped once after the last layer. Without a renderer (dev harnesses) the canvas path remains.
 */
export async function loadPBRArray(ids: string[], size = TIER_CONFIG.layerSize): Promise<{ map: THREE.DataArrayTexture | THREE.CompressedArrayTexture; normalMap: THREE.DataArrayTexture | THREE.CompressedArrayTexture; armMap: THREE.DataArrayTexture | THREE.CompressedArrayTexture }> {
  const kinds = ['diffuse', 'nor_gl', 'arm'] as const;
  // decoded straight to the layer size (no flip: the layer keeps the file's orientation either way)
  const load = (url: string) => fetchImage(url, size, false, true); // exact: the phone's half-res ARM planes scale up off-thread
  const arrayLabel = (kind: (typeof kinds)[number]) => `pbr-array/${kind}:${ids.map((id) => texUrl(id, kind)).join(',')}`;
  const finish = (t: THREE.DataArrayTexture, srgb: boolean, kind: (typeof kinds)[number]) => {
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return labelAsset(t, 'engine/loadPBRArray', arrayLabel(kind));
  };
  const buildGPU = async (kind: (typeof kinds)[number], srgb: boolean, renderer: Renderer) => {
    // Each kind's array is as big as its files (capped at `size`), never scaled up: the phone's half-res ARM
    // planes make a 512² ARM array. Scaling them to 1024 at decode (resizeQuality 'high') ran on the main
    // thread, ~75 ms a layer at 4x CPU — 0.3 s of the terrain step for texels the file never had.
    const layers = await Promise.all(ids.map((id) => fetchImage(texUrl(id, kind), size, false)));
    const n = Math.min(size, Math.max(1, ...layers.map((l) => Math.max(l.width, l.height))));
    const t = finish(new THREE.DataArrayTexture(null, n, n, ids.length), srgb, kind);
    t.source.dataReady = false;          // allocate the storage (texStorage3D, all mip levels), upload nothing
    renderer.initTexture(t);
    let ctx: CanvasRenderingContext2D | null = null;
    for (const [i, layer] of layers.entries()) {
      let im: TexImageSource = layer;
      if (im.width !== n || im.height !== n) { // a layer of another size than its kind's largest: scale it on a canvas instead of failing the copy
        ctx ??= Object.assign(document.createElement('canvas'), { width: n, height: n }).getContext('2d');
        if (ctx === null) throw new Error('loadPBRArray: no 2d canvas context');
        ctx.drawImage(im, 0, 0, n, n);
        im = ctx.canvas;
      }
      const src = new THREE.Texture(im as HTMLImageElement); // never uploaded itself: copyTextureToTexture reads its image
      src.flipY = false;
      t.generateMipmaps = i === ids.length - 1; // one generateMipmap, after the last layer
      renderer.copyTextureToTexture(src, t, null, new THREE.Vector3(0, 0, i));
    }
    t.generateMipmaps = true;
    return t;
  };
  const buildCPU = async (kind: (typeof kinds)[number], srgb: boolean) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('loadPBRArray: no 2d canvas context');
    const data = new Uint8Array(size * size * 4 * ids.length);
    for (const [i, id] of ids.entries()) {
      const im = await load(texUrl(id, kind));
      ctx.drawImage(im, 0, 0, size, size);
      data.set(ctx.getImageData(0, 0, size, size).data, i * size * size * 4);
    }
    return finish(new THREE.DataArrayTexture(data, size, size, ids.length), srgb, kind);
  };
  // E157: the layers' KTX2 stand-ins, their mips concatenated into one compressed array (no decode, no upload copies)
  const buildKtx2 = async (kind: (typeof kinds)[number], srgb: boolean): Promise<THREE.CompressedArrayTexture | null> => {
    const k = await ktx2Layers(ids.map((id) => tierUrl(texUrl(id, kind))), size);
    if (!k) return null;
    const t = releaseAfterUpload(new THREE.CompressedArrayTexture(k.mipmaps, k.n, k.n, ids.length, k.format));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false; t.anisotropy = maxAniso; t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return labelAsset(t, 'engine/loadPBRArray', arrayLabel(kind));
  };
  const build = async (kind: (typeof kinds)[number], srgb: boolean): Promise<THREE.DataArrayTexture | THREE.CompressedArrayTexture> =>
    (await buildKtx2(kind, srgb)) ?? (gpu ? buildGPU(kind, srgb, gpu) : buildCPU(kind, srgb));
  const [map, normalMap, armMap] = await Promise.all([build('diffuse', true), build('nor_gl', false), build('arm', false)]);
  return { map, normalMap, armMap };
}

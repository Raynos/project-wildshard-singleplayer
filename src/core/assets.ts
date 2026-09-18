import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { fetchImage } from '../boot/bytes';
import { TIER_CONFIG } from './tier';
import { PUBLIC_BYTES } from '../boot/bytes.generated';

const gltfLoader = new GLTFLoader();
const hdrLoader = new RGBELoader();

export interface PBRSet { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }

let maxAniso = 8;
let gpu: THREE.WebGLRenderer | null = null;
export function setAnisotropy(renderer: THREE.WebGLRenderer) { gpu = renderer; maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy()); }

/**
 * Decoded images, one per URL: the same file asked for twice (rock_ground: terrain slab and cabin
 * rubble) is fetched and decoded once. Decoding goes through fetch → createImageBitmap (off the main
 * thread, bytes counted by the boot plan) and is capped at the tier's texture size — on a phone a
 * 2048² Poly Haven set becomes 1024², a quarter of the GPU memory and upload time.
 */
const images = new Map<string, Promise<ImageBitmap | HTMLImageElement>>();
export function loadImage(url: string, maxSize = TIER_CONFIG.maxTexture): Promise<ImageBitmap | HTMLImageElement> {
  let p = images.get(url);
  if (!p) { p = fetchImage(url, maxSize); images.set(url, p); }
  return p;
}

export async function loadTexture(url: string, srgb = false, repeat = 1): Promise<THREE.Texture> {
  const image = await loadImage(url);
  const t = new THREE.Texture(image);
  t.flipY = !(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap); // bitmaps are flipped at decode
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * URL of one map of a Poly Haven set. The phone tier gets the `_1k.jpg` sibling
 * (scripts/tex-tiers.mjs: ≤ 1024², q82 — a quarter of the bytes) when the build has one.
 */
export function texUrl(id: string, kind: 'diffuse' | 'nor_gl' | 'arm'): string {
  const base = `/assets/tex/${id}/${kind}`;
  if (TIER_CONFIG.maxTexture <= 1024 && `${base}_1k.jpg` in PUBLIC_BYTES) return `${base}_1k.jpg`;
  return `${base}.jpg`;
}
export const pbrUrls = (id: string) => (['diffuse', 'nor_gl', 'arm'] as const).map((k) => texUrl(id, k));

/** Poly Haven texture set: diffuse + GL normal + ARM (ao / roughness / metal). Textures are shared per url; `repeat` is per call. */
export async function loadPBR(id: string, repeat = 1): Promise<PBRSet> {
  const [map, normalMap, armMap] = await Promise.all([
    loadTexture(texUrl(id, 'diffuse'), true, repeat),
    loadTexture(texUrl(id, 'nor_gl'), false, repeat),
    loadTexture(texUrl(id, 'arm'), false, repeat),
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
  return new Promise((res, rej) => gltfLoader.load(`/assets/models/${id}/${id}.gltf`, res, undefined, rej));
}

export function loadHDR(url: string): Promise<THREE.DataTexture> {
  return new Promise((res, rej) => hdrLoader.load(url, res, undefined, rej));
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
export async function loadPBRArray(ids: string[], size = TIER_CONFIG.layerSize): Promise<{ map: THREE.DataArrayTexture; normalMap: THREE.DataArrayTexture; armMap: THREE.DataArrayTexture }> {
  const kinds = ['diffuse', 'nor_gl', 'arm'] as const;
  // decoded straight to the layer size (no flip: the layer keeps the file's orientation either way)
  const load = (url: string) => fetchImage(url, size, false);
  const finish = (t: THREE.DataArrayTexture, srgb: boolean) => {
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const buildGPU = async (kind: (typeof kinds)[number], srgb: boolean, renderer: THREE.WebGLRenderer) => {
    const t = finish(new THREE.DataArrayTexture(null, size, size, ids.length), srgb);
    t.source.dataReady = false;          // allocate the storage (texStorage3D, all mip levels), upload nothing
    renderer.initTexture(t);
    const images = await Promise.all(ids.map((id) => load(texUrl(id, kind))));
    let canvas: HTMLCanvasElement | null = null;
    for (let i = 0; i < ids.length; i++) {
      let im: TexImageSource = images[i]!;
      if (im.width !== size || im.height !== size) { // a smaller source: scale it on a canvas (the old path) instead of failing the copy
        canvas ??= Object.assign(document.createElement('canvas'), { width: size, height: size });
        canvas.getContext('2d')!.drawImage(im, 0, 0, size, size);
        im = canvas;
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const data = new Uint8Array(size * size * 4 * ids.length);
    for (let i = 0; i < ids.length; i++) {
      const im = await load(texUrl(ids[i]!, kind));
      ctx.drawImage(im, 0, 0, size, size);
      data.set(ctx.getImageData(0, 0, size, size).data, i * size * size * 4);
    }
    return finish(new THREE.DataArrayTexture(data, size, size, ids.length), srgb);
  };
  const build = (kind: (typeof kinds)[number], srgb: boolean) => (gpu && !new URLSearchParams(location.search).has('cpuarray') ? buildGPU(kind, srgb, gpu) : buildCPU(kind, srgb));
  const [map, normalMap, armMap] = await Promise.all([build('diffuse', true), build('nor_gl', false), build('arm', false)]);
  return { map, normalMap, armMap };
}

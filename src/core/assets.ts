import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const hdrLoader = new RGBELoader();

export interface PBRSet { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }

let maxAniso = 8;
export function setAnisotropy(renderer: THREE.WebGLRenderer) { maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy()); }

export function loadTexture(url: string, srgb = false, repeat = 1): Promise<THREE.Texture> {
  return new Promise((res, rej) => texLoader.load(url, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }, undefined, rej));
}

/** Poly Haven texture set: diffuse + GL normal + ARM (ao / roughness / metal) */
export async function loadPBR(id: string, repeat = 1): Promise<PBRSet> {
  const base = `/assets/tex/${id}/`;
  const [map, normalMap, armMap] = await Promise.all([
    loadTexture(base + 'diffuse.jpg', true, repeat),
    loadTexture(base + 'nor_gl.jpg', false, repeat),
    loadTexture(base + 'arm.jpg', false, repeat),
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
 */
export async function loadPBRArray(ids: string[], size = 1024): Promise<{ map: THREE.DataArrayTexture; normalMap: THREE.DataArrayTexture; armMap: THREE.DataArrayTexture }> {
  const kinds = ['diffuse', 'nor_gl', 'arm'] as const;
  const load = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const build = async (kind: (typeof kinds)[number], srgb: boolean) => {
    const data = new Uint8Array(size * size * 4 * ids.length);
    for (let i = 0; i < ids.length; i++) {
      const im = await load(`/assets/tex/${ids[i]}/${kind}.jpg`);
      ctx.drawImage(im, 0, 0, size, size);
      data.set(ctx.getImageData(0, 0, size, size).data, i * size * size * 4);
    }
    const t = new THREE.DataArrayTexture(data, size, size, ids.length);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const [map, normalMap, armMap] = await Promise.all([build('diffuse', true), build('nor_gl', false), build('arm', false)]);
  return { map, normalMap, armMap };
}

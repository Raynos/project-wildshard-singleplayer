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

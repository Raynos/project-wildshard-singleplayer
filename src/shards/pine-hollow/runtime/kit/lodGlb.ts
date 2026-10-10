import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A model library's LOD glTF, flattened (SHARD-PLATFORM M3, the kit system): `loadLodGlb` fetches one scene; `flattenGlbParts`
 * turns it into (geometry, material, world matrix) parts, each material's maps at 8× anisotropy and set up by the caller
 * (a sky's `setupMaterial`).
 */

/** One flattened part: a mesh's geometry and material under its world matrix. */
export interface GlbPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

const loader = new GLTFLoader();
/** Fetches a glTF scene. */
export function loadLodGlb(url: string): Promise<{ scene: THREE.Group }> {
  return new Promise<{ scene: THREE.Group }>((resolve, reject) => { loader.load(url, resolve, undefined, reject); });
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;
/** The scene's meshes as parts in traversal order, each standard material's maps at 8× anisotropy and passed to `setup`. */
export function flattenGlbParts(scene: THREE.Object3D, setup: (m: THREE.MeshStandardMaterial) => void): GlbPart[] {
  scene.updateMatrixWorld(true);
  const out: GlbPart[] = [];
  scene.traverse((m) => {
    if (!isMesh(m)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (t) t.anisotropy = 8;
    setup(mat);
    out.push({ geometry: m.geometry, material: mat, matrix: m.matrixWorld.clone() });
  });
  return out;
}

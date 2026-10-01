/**
 * Loading a generated prop's GLB for a model (E315 M2): the TRELLIS / Hunyuan3D props ship as `<id>.glb` (LOD0; the
 * boot maps it to the phone's `<id>.phone.glb`) and `<id>-lod1.glb` (a quarter of the triangles), meshopt-compressed.
 * A model's loader reads them into its shard's context before `place` (which is synchronous), and its `build` / `lods`
 * hand the parts back. Moved from src/shards/pine-hollow/world/landmarks.ts (Pine Hollow's hero props).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** one mesh of a GLB in the file's own space, and its bounds */
export interface GlbPart { geometry: THREE.BufferGeometry; material: THREE.Material; box: THREE.Box3 }

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** the meshopt build quantizes (normalized int16 positions under a scaled node): back to float before a matrix is baked in,
 *  or `applyMatrix4` clamps every position to the unit box */
function dequantize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name);
    if (a.array instanceof Float32Array && !a.normalized && !('isInterleavedBufferAttribute' in a)) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}

/**
 * The GLB's first mesh, its node transform baked in (dequantized first), its material handed to `prepare` (the shard's
 * look: `sky.setupMaterial`, texture filtering). null when the file does not load.
 */
export async function loadGlbPart(url: string, prepare: (m: THREE.Material) => void): Promise<GlbPart | null> {
  try {
    const g = await gltf.loadAsync(url);
    let found: GlbPart | null = null;
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (found !== null || !('isMesh' in o)) return;
      const mesh = o as THREE.Mesh;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!material) return;
      const geometry = dequantize(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
      geometry.computeBoundingBox();
      prepare(material);
      found = { geometry, material, box: geometry.boundingBox ?? new THREE.Box3() };
    });
    return found;
  } catch (e: unknown) {
    console.warn(`[models] ${url} did not load`, e);
    return null;
  }
}

/** A LOD pair: the decimated LOD1's own base-centre pivot can land off LOD0's (a lopsided stone): its bounds are lined up with LOD0's. */
export async function loadLodPair(url0: string, url1: string, prepare: (m: THREE.Material) => void): Promise<{ lod0: GlbPart | null; lod1: GlbPart | null }> {
  const [lod0, lod1] = await Promise.all([loadGlbPart(url0, prepare), loadGlbPart(url1, prepare)]);
  if (lod0 && lod1) {
    const c0 = lod0.box.getCenter(new THREE.Vector3()), c1 = lod1.box.getCenter(new THREE.Vector3());
    lod1.geometry.translate(c0.x - c1.x, 0, c0.z - c1.z);
    lod1.box.translate(new THREE.Vector3(c0.x - c1.x, 0, c0.z - c1.z));
  }
  return { lod0, lod1 };
}

/** a generated prop's parts, loaded into a shard's context under `key` (`loadLodPairInto`) */
export interface LodPair { lod0: GlbPart | null; lod1: GlbPart | null }

/** Load a LOD pair into `ctx` under `key` (once per shard; a second call reuses the first load). */
export async function loadLodPairInto(ctx: { once: <T>(key: string, make: () => T) => T }, key: string, url0: string, url1: string, prepare: (m: THREE.Material) => void): Promise<LodPair> {
  const pending = ctx.once<Promise<LodPair>>(`${key}:load`, () => loadLodPair(url0, url1, prepare));
  const pair = await pending;
  return ctx.once(key, () => pair);
}

/** the pair loaded under `key` (throws when its loader has not run: `place` is synchronous, load first) */
export function lodPairOf(ctx: { once: <T>(key: string, make: () => T) => T }, key: string): LodPair {
  return ctx.once<LodPair>(key, () => { throw new Error(`[models] ${key}: not loaded (load it before place)`); });
}

/** a convex hull's points from a part's vertices (≤ `maxPts`, every n-th), in its own space */
export function vertexHull(g: THREE.BufferGeometry, maxPts: number): Float32Array {
  const pos = g.getAttribute('position');
  const step = Math.max(1, Math.floor(pos.count / maxPts));
  const pts = new Float32Array(Math.ceil(pos.count / step) * 3);
  let k = 0;
  for (let i = 0; i < pos.count; i += step) { pts[k++] = pos.getX(i); pts[k++] = pos.getY(i); pts[k++] = pos.getZ(i); }
  return pts.subarray(0, k);
}

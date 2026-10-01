/**
 * E343: generated heads for code-built figures (Jake's pick D, "one technique for all": a Hunyuan3D-2 head with its own
 * paint, cut at its own neck). Each file is a head alone — scripts/img2mesh/head_cut.py (the bust cut at its neck,
 * dipping under the jaw) → scripts/img2mesh/driftwood_post.py (the faceted toon post: collapse-decimated, one flat colour
 * per facet, AO in COLOR_0.a, fitted to the code head's height, its neck at y = 0, facing +z).
 *
 *   await loadFaceHead(url);          // a promise (cached); null if the file failed (the code head stays)
 *   const h = faceHead(url);          // the loaded head or null — sync, for the builders that run after a preload
 *
 * A head is non-indexed triangles: position, flat normal, colour (rgb = albedo × the baked AO, 0.4 + 0.6 × a, as the
 * kits read vertex colour) — metres, the figure's own head frame.
 */
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface FaceHead { readonly pos: Float32Array; readonly nrm: Float32Array; readonly col: Float32Array; readonly count: number }

const ready = new Map<string, FaceHead>();
const loading = new Map<string, Promise<FaceHead | null>>();
let loader: GLTFLoader | null = null;

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

function toHead(g0: THREE.BufferGeometry): FaceHead {
  const g = g0.index !== null ? g0.toNonIndexed() : g0;
  g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const count = p.count;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
    nrm[i * 3] = n.getX(i); nrm[i * 3 + 1] = n.getY(i); nrm[i * 3 + 2] = n.getZ(i);
    if (c === null) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; continue; }
    const ao = c.itemSize === 4 ? 0.4 + 0.6 * c.getW(i) : 1;
    col[i * 3] = c.getX(i) * ao; col[i * 3 + 1] = c.getY(i) * ao; col[i * 3 + 2] = c.getZ(i) * ao;
  }
  return { pos, nrm, col, count };
}

export function loadFaceHead(url: string): Promise<FaceHead | null> {
  let p = loading.get(url);
  if (!p) {
    if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
    p = loader.loadAsync(url).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
      const m = meshes[0];
      if (m === undefined) return null;
      const head = toHead(m.geometry.clone().applyMatrix4(m.matrixWorld));
      ready.set(url, head);
      return head;
    }).catch((e: unknown) => { console.warn(`[faces] head ${url} failed`, e); return null; });
    loading.set(url, p);
  }
  return p;
}

export function faceHead(url: string): FaceHead | null { return ready.get(url) ?? null; }

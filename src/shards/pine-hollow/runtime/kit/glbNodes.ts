import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Material as SurfaceMaterial } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

/**
 * A GLB kit's nodes as float geometries (SHARD-PLATFORM M3, the kit system): a Blender kit ships meshopt-quantized nodes,
 * each a module (`<id>`, `<id>-lod1` …) in its file frame. `loadGlbNodes` reads every mesh node into a geometry baked into
 * world (file) space with float positions and normals, the vertex colour as a vec4 attribute and the first UV as a vec2
 * attribute under the names the shard's program reads (a missing colour is 1, a missing UV 0); nothing else is kept.
 * `trimeshDesc` turns a placed geometry into a static trimesh collider. Nothing here knows a shard's kit.
 */

/** The attribute names a kit's program reads its vertex colour (vec4) and its first UV (vec2) under. */
export interface GlbNodeAttributes {
  readonly color: string;
  readonly uv: string;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** One node's geometry: position / normal back to float, the colour → `names.color` (vec4), the UV → `names.uv` (vec2), `matrix` applied. */
export function nodeGeometry(src: THREE.BufferGeometry, matrix: THREE.Matrix4, names: GlbNodeAttributes): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const f32 = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < a.itemSize ? a.getComponent(i, k) : 1;
    return out;
  };
  const n = src.getAttribute('position').count;
  g.setAttribute('position', new THREE.BufferAttribute(f32('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32('normal', 3), 3));
  g.setAttribute(names.color, src.hasAttribute('color') ? new THREE.BufferAttribute(f32('color', 4), 4) : new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4));
  g.setAttribute(names.uv, src.hasAttribute('uv') ? new THREE.BufferAttribute(f32('uv', 2), 2) : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const idx = src.getIndex();
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)), 1));
  g.applyMatrix4(matrix);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Every mesh node of the GLB at `url` by node name, as `nodeGeometry` builds it (its world matrix baked in). */
export async function loadGlbNodes(url: string, names: GlbNodeAttributes): Promise<Map<string, THREE.BufferGeometry>> {
  const out = new Map<string, THREE.BufferGeometry>();
  const g = await loader.loadAsync(url);
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!('isMesh' in o)) return;
    const mesh = o as THREE.Mesh;
    out.set(mesh.name, nodeGeometry(mesh.geometry, mesh.matrixWorld, names));
  });
  return out;
}

/** The geometry placed by `m` as a static trimesh collider, its vertices relative to m's translation. */
export function trimeshDesc(g: THREE.BufferGeometry, m: THREE.Matrix4, surface: SurfaceMaterial): ColliderDesc {
  const pos = g.getAttribute('position');
  const o = new THREE.Vector3().setFromMatrixPosition(m);
  const verts = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); verts[i * 3] = v.x - o.x; verts[i * 3 + 1] = v.y - o.y; verts[i * 3 + 2] = v.z - o.z; }
  const idx = g.getIndex();
  const indices = idx ? Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)) : Uint32Array.from({ length: pos.count }, (_v, i) => i);
  return { kind: 'trimesh', x: o.x, y: o.y, z: o.z, vertices: verts, indices, surface };
}

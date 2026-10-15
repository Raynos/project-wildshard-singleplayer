import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

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

/** One projected float channel. Missing channels require a finite `fill`; wider channels pad with 1. */
export interface GlbNodeAttribute {
  readonly source: string;
  readonly size: 1 | 2 | 3 | 4;
  readonly fill?: number;
}

/**
 * Read named mesh nodes in file space, dequantizing before applying each complete world transform.
 * Without `attributes`, retain all channels. A projection explicitly selects/renames float channels;
 * position must remain a vec3 named position. RGB colours can become RGBA, and absent UVs can use fill:0.
 * The returned geometry is owned by the caller; source geometry and borrowed materials stay untouched.
 * `prepare` receives each borrowed material, An Object3D source avoids another load.
 */
export async function loadGlbNodes(source: string | THREE.Object3D, attributes?: Readonly<Record<string, GlbNodeAttribute>>, prepare?: (material: THREE.Material) => void): Promise<Map<string, THREE.BufferGeometry>> {
  if (attributes !== undefined) {
    const channels = Object.entries(attributes);
    if (channels.length > 16 || attributes['position']?.source !== 'position' || attributes['position'].size !== 3 ||
      channels.some(([name, row]) => !name || !row.source || ![1, 2, 3, 4].includes(row.size) || (row.fill !== undefined && !Number.isFinite(row.fill)))) throw new Error('Invalid GLB attribute projection');
  }
  const scene = typeof source === 'string' ? (await gltf.loadAsync(source)).scene : source;
  scene.updateMatrixWorld(true);
  const out = new Map<string, THREE.BufferGeometry>();
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node as THREE.Mesh;
    const src = mesh.geometry;
    let geometry: THREE.BufferGeometry;
    if (attributes === undefined) geometry = dequantize(src.clone());
    else {
      geometry = new THREE.BufferGeometry();
      const count = src.getAttribute('position').count;
      for (const [name, row] of Object.entries(attributes)) {
        const attr = src.hasAttribute(row.source) ? src.getAttribute(row.source) : undefined;
        if (attr === undefined && row.fill === undefined) throw new Error(`Missing GLB attribute: ${row.source}`);
        if (attr !== undefined && attr.count !== count) throw new Error(`Mismatched GLB attribute: ${row.source}`);
        const values = new Float32Array(count * row.size);
        for (let i = 0; i < count; i++) for (let k = 0; k < row.size; k++) values[i * row.size + k] = attr === undefined ? (row.fill ?? 0) : k < attr.itemSize ? attr.getComponent(i, k) : 1;
        geometry.setAttribute(name, new THREE.BufferAttribute(values, row.size));
      }
      const index = src.getIndex();
      if (index) geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: index.count }, (_v, i) => index.getX(i)), 1));
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) prepare?.(material);
    out.set(node.name, geometry);
  });
  return out;
}


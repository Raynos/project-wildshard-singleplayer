import * as THREE from 'three';
import { voxelAO, hemisphere } from '@wildshard/engine/world/voxelAO';

/** a float copy of an attribute (de-quantises normalized ints) */
function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

export interface RawModel { geometry: THREE.BufferGeometry; map: THREE.Texture | null; box: THREE.Box3 }
export function rawFromGltf(scene: THREE.Object3D, label: string): RawModel {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
  const found = meshes[0];
  if (!found) throw new Error(`nalati model ${label}: no mesh`);
  const src = found.geometry;
  const geometry = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
  }
  const index = src.getIndex();
  if (index) geometry.setIndex(Array.from(index.array));
  geometry.applyMatrix4(found.matrixWorld);
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  // painterly materials always read vertex colours: the model's own (a far LOD's coat, a Blender model's albedo), else a
  // white one (the atlas carries it). Float rgb, so the model-shading variant can swap its baked colours in place
  const nv = geometry.getAttribute('position').count;
  const rgb = new Float32Array(nv * 3).fill(1);
  if (src.hasAttribute('color')) {
    const c = src.getAttribute('color');
    const ao = c.itemSize === 4;
    for (let i = 0; i < nv; i++) {
      const k = ao ? 0.4 + 0.6 * c.getW(i) : 1;
      rgb[i * 3] = c.getX(i) * k; rgb[i * 3 + 1] = c.getY(i) * k; rgb[i * 3 + 2] = c.getZ(i) * k;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const srcMat = found.material;
  const first = Array.isArray(srcMat) ? srcMat[0] : srcMat;
  const map = first instanceof THREE.MeshStandardMaterial && first.map ? first.map : null;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
  const box = geometry.boundingBox?.clone() ?? new THREE.Box3();
  return { geometry, map, box };
}

// 14 hemisphere directions (+z up in a tangent frame; lowpolyKit's set, so the two bakes weigh alike)
const HEMI = hemisphere([[0.95, 1], [0.72, 5], [0.38, 8]], 1.7);
/** a warm umber, not the kit's violet: the painted world's shade is already cool, the crevices should read as earth */
const AO_TINT = new THREE.Color('#5b4636');
const AO_STRENGTH = 0.7, AO_DOWN = 0.22;

/**
 * The one `voxelAO`, per vertex, for a smooth indexed mesh in its own space (the ground is the plane under its bounding
 * box): the triangles are rasterised into an occupancy grid, each vertex marches 14 hemisphere rays from just off its
 * surface, and the occluded fraction (+ a little for facing down) pulls its colour toward AO_TINT. ~5–40 ms per model, once.
 * Exported for the byte-identity test (test/engine/voxel-ao.test.ts).
 */
export function bakeVertexAO(geo: THREE.BufferGeometry, plain: Float32Array): Float32Array {
  const out = plain.slice();
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox ?? new THREE.Box3();
  const ext = new THREE.Vector3(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
  const cell = Math.max(0.03, Math.max(ext.x, ext.y, ext.z) / 64);
  const steps = 10, dist = cell * 10;
  const ks = voxelAO(geo, {
    box, cell, pad: 3, spacing: 0.7, maxSamples: 200, indexed: true,
    ground: { below: box.min.y },   // the ground the model stands on: its base (0 for a GLB as loaded; a fitted clone's own bottom)
    sample: 'vertex', offset: 1.5, hemi: HEMI, steps, stepLen: dist / steps, falloff: 0.5, strength: AO_STRENGTH, downDark: AO_DOWN,
  });
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i] ?? Number.NaN;
    if (Number.isNaN(k)) continue;
    out[i * 3] = (plain[i * 3] ?? 1) * (1 - k + AO_TINT.r * k);
    out[i * 3 + 1] = (plain[i * 3 + 1] ?? 1) * (1 - k + AO_TINT.g * k);
    out[i * 3 + 2] = (plain[i * 3 + 2] ?? 1) * (1 - k + AO_TINT.b * k);
  }
  return out;
}


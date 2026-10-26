import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { ISLAND_LOOK } from './islandRows';

/** The Blender cove's prototypes at build (SHARD-PLATFORM C2): read from island.glb for the facts and the cover splat,
 *  and baked for the page with each palm's far copy simplified. Reads no generated table (the facts bake imports it). */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

/** a prototype as the bake holds it: world-space positions, Uint8 RGBA (alpha: its baked AO), index */
export interface IslandProto { pos: Float32Array; col: Uint8Array; index: Uint32Array }

/** `p` with its triangles simplified (to `ratio` of them, never past `error` of its size) and its vertices compacted. */
function simplifiedProto(p: IslandProto, ratio: number, error: number): IslandProto {
  const [idx] = MeshoptSimplifier.simplify(p.index, p.pos, 3, Math.max(3, Math.floor((p.index.length * ratio) / 3) * 3), error);
  const remap = new Int32Array(p.pos.length / 3).fill(-1);
  let n = 0;
  for (const vi of idx) if ((remap[vi] ?? 0) < 0) remap[vi] = n++;
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 4), index = Uint32Array.from(idx, (vi) => remap[vi] ?? 0);
  remap.forEach((r, vi) => { if (r >= 0) { pos.set(p.pos.subarray(vi * 3, vi * 3 + 3), r * 3); col.set(p.col.subarray(vi * 4, vi * 4 + 4), r * 4); } });
  return { pos, col, index };
}

/** island.glb's prototypes (world space, Uint8 colour + baked AO) by island.json's order; a `lod` pair's far copy is
 *  its near one simplified (E117: not the file's hand-made `_lo`, so a far copy keeps its near copy's shape). */
export async function islandProtos(glb: Uint8Array, meta: { protos: readonly { name: string }[]; lod?: Readonly<Record<string, number>> }): Promise<(IslandProto | undefined)[]> {
  await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(glb).buffer, '');
  try {
    gltf.scene.updateMatrixWorld(true);
    const protoIndex = new Map(meta.protos.map((p, i) => [`${ISLAND_LOOK.protoPrefix}${p.name}`, i])), protos: (IslandProto | undefined)[] = [];
    gltf.scene.traverse((o) => {
      const pi = protoIndex.get(o.name);
      if (!isMesh(o) || pi === undefined) return;
      const p = o.geometry.getAttribute('position'), c = o.geometry.getAttribute('color'), idx = o.geometry.getIndex(), at = new THREE.Vector3();
      const pos = new Float32Array(p.count * 3), col = new Uint8Array(p.count * 4).fill(255);
      for (let i = 0; i < p.count; i++) {
        at.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).toArray(pos, i * 3);
        (c.itemSize > 3 ? [c.getX(i), c.getY(i), c.getZ(i), c.getW(i)] : [c.getX(i), c.getY(i), c.getZ(i)]).forEach((x, k) => { col[i * 4 + k] = Math.round(THREE.MathUtils.clamp(x, 0, 1) * 255); });
      }
      protos[pi] = { pos, col, index: Uint32Array.from(idx ? idx.array : Array.from({ length: p.count }, (_, i) => i)) };
    });
    for (const [near, lo] of Object.entries(meta.lod ?? {})) { const p = protos[Number(near)]; if (p !== undefined) protos[lo] = simplifiedProto(p, ISLAND_LOOK.far.ratio, ISLAND_LOOK.far.error); }
    return protos;
  } finally {
    gltf.scene.traverse(o => { if (isMesh(o)) { o.geometry.dispose(); for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.dispose(); } });
  }
}

/** SHARD-PLATFORM C2: the cove's prototypes as the page draws them, one named mesh each (far copies simplified here),
 *  with their flat-shading normals (the shadows' normal bias); the page clones them, nothing is rebuilt at load. */
export async function islandProtoGlb(glb: Uint8Array, meta: { protos: readonly { name: string }[]; lod: Readonly<Record<string, number>> }): Promise<Uint8Array> {
  const protos = await islandProtos(glb, meta), material = new THREE.MeshStandardMaterial();
  return staticGlb(meta.protos.flatMap((row, i) => {
    const p = protos[i]; if (p === undefined) return [];
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p.pos, 3)).setAttribute('color', new THREE.BufferAttribute(p.col, 4, true)).setIndex(new THREE.BufferAttribute(p.index, 1));
    geometry.computeVertexNormals();
    return [{ geometry, material, name: row.name }];
  }), 'island-protos');
}

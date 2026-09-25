/**
 * PH-B4 (Jake's PH-U17): the Blender-built photoreal species set, as the forest loads it. scripts/blender/trees/ builds it
 * (treegen.py the geometry, build_trees.py the Cycles bakes, run.sh the compression) into `public/assets/models/<set>/`:
 *
 *   trees.glb                     per variant (TREE_SPECS_V2 order, meshes `<name>__<part>` (three's GLTFLoader strips a '.')): trunk / trunkLo (bark),
 *                                 hi / lo / twigs (branch cards), far (the 2-quad impostor cross) — meshopt
 *   cards-{albedo.png,normal,arm} the branch-card atlas, 2 × 2 cells (pine tuft, fir spray, birch sprig, dead twig + lichen)
 *   impostor-{albedo.png,normal}  4 × 4 cells of 256 × 512, each variant's hi LOD rendered from the side
 *   (+ .phone.webp copies at half size, picked by tierUrl)
 * The trunks tile the bark sets `BARK_LAYERS` (public/assets/tex/<id>, one DataArrayTexture; the GLB's TEXCOORD_1.x is
 * the layer). TreeFactory.buildSet turns this into the same `TreeVariant`s the runtime pines are, so Forest.ts's LOD,
 * wind, fades, batching and colliders run unchanged.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** the bark array's layers, in the order treegen.py's BARK_* constants index them */
export const BARK_LAYERS = ['pine_bark', 'fir_bark', 'metasequoia_bark', 'birch_bark', 'bark_willow_02'] as const;

export const TREE_SET_PARTS = ['trunk', 'trunkLo', 'hi', 'lo', 'twigs', 'far'] as const;
export type TreeSetPart = (typeof TREE_SET_PARTS)[number];

export function treeSetUrls(set: string): { glb: string; cardsAlbedo: string; cardsNormal: string; cardsArm: string; farAlbedo: string; farNormal: string } {
  const b = `/assets/models/${set}`;
  return {
    glb: `${b}/trees.glb`,
    cardsAlbedo: `${b}/cards-albedo.png`, cardsNormal: `${b}/cards-normal.jpg`, cardsArm: `${b}/cards-arm.jpg`,
    farAlbedo: `${b}/impostor-albedo.png`, farNormal: `${b}/impostor-normal.jpg`,
  };
}

/** Every file the set's boot reads (the boot manifest's `trees` source; the bark sets are added there through pbrUrls). */
export function treeSetFiles(set: string): string[] { return Object.values(treeSetUrls(set)); }

/**
 * One GLB part as a plain float geometry in the tree's own space: meshopt's quantised streams decoded, the node's
 * dequantising transform applied, the attributes Forest's materials read — position, normal, uv, color (crown
 * occlusion / bark tint), `windWeight` (the sway's height fraction, TreeFactory `patchWind`: y / height, the bark's
 * 0.35 × that), and on the bark `barkLayer`.
 */
function plain(mesh: THREE.Mesh, height: number, part: TreeSetPart): THREE.BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array | null => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) return null;
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      out[i * size] = a.getX(i);
      if (size > 1) out[i * size + 1] = a.getY(i);
      if (size > 2) out[i * size + 2] = a.itemSize > 2 ? a.getZ(i) : 0;
    }
    return out;
  };
  const need = (name: string, size: number): Float32Array => {
    const a = copy(name, size);
    if (!a) throw new Error(`[trees] ${mesh.name}: no ${name}`);
    return a;
  };
  g.setAttribute('position', new THREE.BufferAttribute(need('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(need('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(need('uv', 2), 2));
  const col = copy('color', 3);
  g.setAttribute('color', new THREE.BufferAttribute(col ?? new Float32Array(src.getAttribute('position').count * 3).fill(1), 3));
  const idx = src.getIndex();
  if (!idx) throw new Error(`[trees] ${mesh.name}: not indexed`);
  g.setIndex(new THREE.BufferAttribute(idx.array.slice(), 1));
  g.applyMatrix4(mesh.matrixWorld);
  const bark = part === 'trunk' || part === 'trunkLo';
  const pos = g.getAttribute('position');
  const wind = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) wind[i] = (pos.getY(i) / height) * (bark ? 0.35 : 1);
  g.setAttribute('windWeight', new THREE.BufferAttribute(wind, 1));
  if (bark) {
    const layer = copy('uv1', 1);
    g.setAttribute('barkLayer', new THREE.BufferAttribute(layer ?? new Float32Array(pos.count), 1));
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

/** The set's GLB, as `name → part → geometry` for the given variants (a missing mesh is an error: the set is stale). */
export async function loadTreeSetGeometry(url: string, variants: readonly { name: string; height: number }[]): Promise<Map<string, Record<TreeSetPart, THREE.BufferGeometry>>> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const meshes = new Map<string, THREE.Mesh>();
  gltf.scene.traverse((o) => { if (isMesh(o)) meshes.set(o.name, o); });
  const out = new Map<string, Record<TreeSetPart, THREE.BufferGeometry>>();
  for (const v of variants) {
    const get = (part: TreeSetPart): THREE.BufferGeometry => {
      const m = meshes.get(`${v.name}__${part}`);
      if (!m) throw new Error(`[trees] ${url} has no mesh ${v.name}__${part}`);
      return plain(m, v.height, part);
    };
    out.set(v.name, { trunk: get('trunk'), trunkLo: get('trunkLo'), hi: get('hi'), lo: get('lo'), twigs: get('twigs'), far: get('far') });
  }
  for (const m of meshes.values()) m.geometry.dispose();
  return out;
}

/**
 * The bark material's array lookups: three's map / normalMap / aoMap / roughnessMap reads (all four bound to 1 × 1
 * stand-ins so their defines and uv varyings exist) become reads of the bark arrays at the vertex's layer. The layers are
 * uploaded file-orientation (loadPBRArray, no flip), so v is negated: the bark's up is the image's up, as in Blender.
 */
export function patchBarkArrays(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, arrays: { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }): void {
  shader.uniforms['tBarkD'] = { value: arrays.map };
  shader.uniforms['tBarkN'] = { value: arrays.normalMap };
  shader.uniforms['tBarkA'] = { value: arrays.armMap };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float barkLayer; varying float vBarkLayer;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBarkLayer = barkLayer;');
  const at = (uv: string) => `vec3( ${uv}.x, -${uv}.y, floor( vBarkLayer + 0.5 ) )`;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray tBarkD; uniform sampler2DArray tBarkN; uniform sampler2DArray tBarkA; varying float vBarkLayer;')
    .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture( tBarkD, ${at('vMapUv')} )`))
    .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv )', `vec3 mapN = texture( tBarkN, ${at('vNormalMapUv')} )`))
    .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv )', `texture( tBarkA, ${at('vAoMapUv')} )`))
    .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', `texture( tBarkA, ${at('vRoughnessMapUv')} )`));
}

/** A 1 × 1 texture: the bark material's stand-in maps (the arrays are what it samples). */
export function standIn(rgba: [number, number, number, number]): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1);
  t.needsUpdate = true;
  return t;
}

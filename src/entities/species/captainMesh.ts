import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { BoneDef } from './registry';

/**
 * The Drowned Captain's generated mesh (v0.2, DRIFTWOOD-REMASTER M3): a codex concept (art/driftwood-isle/round-8-assets/
 * ref-captain.jpg) → Hunyuan3D-2 full shape + paint → gltf-transform simplify (12.7 k tris, the generation's own UVs and
 * paint kept) → 1024² WebP → meshopt: public/assets/models/driftwood-hero/captain/captain.glb (~210 KB), facing +z.
 *
 *   void preloadCaptainMesh();          // Finale.ts installs it: loads in the background, long before the altar
 *   const m = captainMeshFor(bones);    // buildCaptain: { parts, map } bound to the captain's own bones, or null
 *
 * At load the mesh is normalized to the rig: 1.9 m tall (the tricorn's top — the rig's head bone sits at 1.56), feet at
 * y = 0, centred on x / z. Binding: every vertex rides the bone whose segment (bone → each child; a leaf is a point) is
 * nearest in the bind pose — rigid, like the loft kit's parts, so animateCaptain() drives it unchanged. The texture goes
 * on the rig's material (AnimalSpecies.map); the vertex colours are white so it shows true. Null until the load finishes
 * (or if it fails): buildCaptain then builds the loft stand-in, so the fight never waits on the file.
 */
const URL_GLB = '/assets/models/driftwood-hero/captain/captain.glb';
const HEIGHT = 1.9;
/** metres from the centre line below which a vertex under the shoulders never rides an arm bone (the coat skirt) */
const ARM_MIN_X = 0.36;
let source: THREE.BufferGeometry | null = null;
let texture: THREE.Texture | null = null;
let loading: Promise<void> | null = null;

/**
 * gltf-transform's meshopt pass quantizes position / normal / uv to normalized ints (KHR_mesh_quantization): copy every
 * attribute out as plain float32 (getComponent de-normalizes), so the node matrix applies cleanly and mergeGeometries sees
 * the same attribute types as the rest of the species parts.
 */
function asFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const n = attr.count, k = attr.itemSize, out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = attr.getComponent(i, j);
    g.setAttribute(name, new THREE.BufferAttribute(out, k));
  }
  if (src.index) g.setIndex(Array.from(src.index.array));
  return g;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

async function load(): Promise<void> {
  try {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(URL_GLB);
    const hit: { geo: THREE.BufferGeometry | null; map: THREE.Texture | null } = { geo: null, map: null };
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (hit.geo !== null || !isMesh(o)) return;
      hit.geo = asFloat(o.geometry).applyMatrix4(o.matrixWorld);
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat instanceof THREE.MeshStandardMaterial) hit.map = mat.map;
    });
    const g = hit.geo;
    if (g === null) return;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (bb === null) return;
    const k = HEIGHT / Math.max(1e-6, bb.max.y - bb.min.y);
    g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, k, k);
    source = g;
    texture = hit.map;
  } catch (e: unknown) { console.warn('[captain] generated mesh not loaded, using the stand-in:', e); }
}

/** the generated mesh has loaded (buildCaptain then fits the rig to it before binding) */
export function captainMeshLoaded(): boolean { return source !== null; }

export function preloadCaptainMesh(): Promise<void> {
  loading ??= load();
  return loading;
}

/**
 * The mesh bound to `bones` (the attributes every species part carries) as TWO geometries — its triangles split in half —
 * because AnimalFactory merges furParts and hardParts separately and neither list may be empty (the captain has no fur,
 * so both halves draw alike), plus its texture. Null before / without the load.
 */
export function captainMeshFor(bones: BoneDef[]): { parts: [THREE.BufferGeometry, THREE.BufferGeometry]; map: THREE.Texture | null } | null {
  if (source === null) return null;
  const g = source.clone();
  const pos = g.getAttribute('position');
  const n = pos.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); // white: the texture carries the albedo
  // bind pose segments: each bone to each of its children, a leaf bone as a point
  const at = new Map(bones.map((b) => [b.name, new THREE.Vector3(...b.pos)]));
  const segs: { a: THREE.Vector3; b: THREE.Vector3; bone: number; arm: boolean }[] = [];
  bones.forEach((b, i) => {
    const kids = bones.filter((c) => c.parent === b.name);
    const a = at.get(b.name);
    if (a === undefined) return;
    const arm = b.name.startsWith('arm');
    if (kids.length === 0) segs.push({ a, b: a, bone: i, arm });
    for (const c of kids) { const e = at.get(c.name); if (e) segs.push({ a, b: e, bone: i, arm }); }
  });
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const p = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    let best = Infinity, bone = 0;
    // the coat skirt hangs beside the hands: below the shoulders only what sits well out from the body rides an arm bone
    // (E70 round 3: the fitted, lower hands otherwise swung coat-tail facets with the arm)
    const coat = p.y < 1.3 && Math.abs(p.x) < ARM_MIN_X;
    for (const s of segs) {
      if (coat && s.arm) continue;
      ab.subVectors(s.b, s.a);
      const len2 = ab.lengthSq();
      const t = len2 > 1e-9 ? Math.min(1, Math.max(0, q.subVectors(p, s.a).dot(ab) / len2)) : 0;
      const d = q.copy(s.a).addScaledVector(ab, t).distanceToSquared(p);
      if (d < best) { best = d; bone = s.bone; }
    }
    si[i * 4] = bone; sw[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('furLen', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight', 'furLen'].includes(key)) g.deleteAttribute(key);
  if (g.index === null) g.setIndex(Array.from({ length: n }, (_, i) => i)); // the species parts are indexed; mergeGeometries wants them all alike
  const idx = g.index;
  if (idx === null) return null;
  const cut = Math.floor(idx.count / 6) * 3;
  const ids = Array.from(idx.array);
  const a = g.clone(), b = g.clone();
  a.setIndex(ids.slice(0, cut)); b.setIndex(ids.slice(cut));
  g.dispose();
  return { parts: [a, b], map: texture };
}

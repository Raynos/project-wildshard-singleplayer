import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { BoneDef } from './registry';

/**
 * The Drowned Captain's generated mesh (v0.2, DRIFTWOOD-REMASTER M3): a codex concept → Hunyuan3D-2 → Blender clean-up
 * (scripts/img2mesh/driftwood_post.py: decimated, faceted, albedo + AO baked into COLOR_0, metres, feet at y = 0, facing
 * +z) → public/assets/models/driftwood-hero/captain/captain.glb.
 *
 *   void preloadCaptainMesh();                        // Finale.ts installs it: loads in the background, long before the altar
 *   const g = captainMeshFor(bones);                  // buildCaptain: the mesh bound to the captain's own bones, or null
 *
 * Binding: every vertex rides the bone whose segment (bone → each child; a leaf is a point) is nearest to it in the bind
 * pose — rigid, like the loft kit's parts, so animateCaptain() drives it unchanged. Null until the load finishes (or if it
 * fails): buildCaptain then builds the loft stand-in, so the fight never waits on the file.
 */
const URL_GLB = '/assets/models/driftwood-hero/captain/captain.glb';
let source: THREE.BufferGeometry | null = null;
let loading: Promise<void> | null = null;

/**
 * gltf-transform's meshopt pass quantizes position / normal / uv to normalized int16 (KHR_mesh_quantization): copy every
 * attribute out as plain float32 (getX… de-normalize), so the node matrix applies cleanly and mergeGeometries sees the
 * same attribute types as the rest of the species parts.
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
    let found: THREE.BufferGeometry | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (found === null && isMesh(o)) found = asFloat(o.geometry).applyMatrix4(o.matrixWorld);
    });
    source = found;
  } catch (e: unknown) { console.warn('[captain] generated mesh not loaded, using the stand-in:', e); }
}

export function preloadCaptainMesh(): Promise<void> {
  loading ??= load();
  return loading;
}

/**
 * The mesh bound to `bones` (the attributes every species part carries) as TWO geometries — its triangles split in half —
 * because AnimalFactory merges furParts and hardParts separately and neither list may be empty (the captain has no fur,
 * so both halves draw alike). Null before / without the load.
 */
export function captainMeshFor(bones: BoneDef[]): [THREE.BufferGeometry, THREE.BufferGeometry] | null {
  if (source === null) return null;
  const g = source.clone();
  const pos = g.getAttribute('position');
  const n = pos.count;
  // colour: COLOR_0 may be RGBA (A = AO) and normalized ints — the species kit wants float RGB, AO folded in
  const col = new Float32Array(n * 3).fill(0.6);
  if (g.hasAttribute('color')) {
    const src = g.getAttribute('color');
    for (let i = 0; i < n; i++) {
      const k = 0.55 + 0.45 * (src.itemSize === 4 ? src.getW(i) : 1); // A = baked AO
      col[i * 3] = src.getX(i) * k; col[i * 3 + 1] = src.getY(i) * k; col[i * 3 + 2] = src.getZ(i) * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // bind pose segments: each bone to each of its children, a leaf bone as a point
  const at = new Map(bones.map((b) => [b.name, new THREE.Vector3(...b.pos)]));
  const segs: { a: THREE.Vector3; b: THREE.Vector3; bone: number }[] = [];
  bones.forEach((b, i) => {
    const kids = bones.filter((c) => c.parent === b.name);
    const a = at.get(b.name);
    if (a === undefined) return;
    if (kids.length === 0) segs.push({ a, b: a, bone: i });
    for (const c of kids) { const e = at.get(c.name); if (e) segs.push({ a, b: e, bone: i }); }
  });
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const p = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    let best = Infinity, bone = 0;
    for (const s of segs) {
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
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight', 'furLen'].includes(k)) g.deleteAttribute(k);
  if (g.index === null) g.setIndex(Array.from({ length: n }, (_, i) => i)); // the species parts are indexed; mergeGeometries wants them all alike
  const idx = g.index;
  if (idx === null) return null;
  const tris = Math.floor(idx.count / 3), cut = Math.floor(tris / 2) * 3;
  const ids = Array.from(idx.array);
  const a = g.clone(), b = g.clone();
  a.setIndex(ids.slice(0, cut)); b.setIndex(ids.slice(cut));
  g.dispose();
  return [a, b];
}

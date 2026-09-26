/**
 * The hamlet's people, generated (PINE-HOLLOW-REMASTER PH-M4): Hale the ranger (board B3 pick A, "the old warden"), Mott
 * the trader, Brandt the miller — photoreal codex references (A-pose, art/pine-hollow/round-11-npcs/) → Hunyuan3D-2 full +
 * paint → the PBR finish (scripts/img2mesh/driftwood_post.py --keep-texture: the generated texture + a normal map, 1.8 m,
 * feet at y = 0, facing +z) → `public/assets/pine-hollow/npcs/<kind>[.phone].glb`. npcFigure.ts's `makeNpcFigure` shows
 * its stand-in until the model has loaded, then swaps this in (Debug ▸ Pine Hollow people = Stand-ins keeps them).
 *
 *   void preloadNpcModels();                  // the quest's install: fetch all three early
 *   const r = npcRig(kind);                   // null until loaded → { mesh (SkinnedMesh), pose(dt, t, s), lanternAt }
 *
 * The rig is built at load, from the hull itself (no offline bake — three people, ~5–9 k verts each): a 13-bone upper-body
 * skeleton placed by the A-pose's proportions (hips, spine, chest, neck, head; each arm shoulder → elbow → hand, the hand
 * the arm cluster's farthest point from the shoulder). The A-pose leaves clear air between the arms and the coat, so a
 * vertex is an arm vertex when it lies outside the torso's column above the waist; arm vertices ride their chain by their
 * position along it (two-bone blends at the elbow and shoulder), the rest ride hips / spine / chest / neck / head by height
 * (blended), everything below the waist the hips (they stand; nobody walks). The clips are procedural bone poses:
 *   idle   breathing, a slow weight shift, the arms lowered from the A-pose to a natural hang, the head on the player
 *   talk   the right forearm gestures, the head nods
 *   point  the right arm raised to the horizontal toward `pointAt` (the ranger, now and then, toward the old-growth)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TIER } from '../../core/tier';
import type { Sky } from '../../world/Sky';
import type { NpcKind } from './npcFigure';
import { mapSlot } from '../../core/shardState';
import { MAY_KTX2 } from '../../boot/gpuFiles';

export const NPC_KINDS: readonly NpcKind[] = ['ranger', 'trader', 'miller'];

/** the file each tier loads (Node-safe: the boot manifest may declare them) */
export function npcModelUrl(kind: NpcKind, tier: 'phone' | 'desktop' = TIER): string {
  return `/assets/pine-hollow/npcs/${kind}${tier === 'phone' ? '.phone' : ''}.glb`;
}

interface Source { geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null }
const sources = new Map<NpcKind, Source>();
const loading = new Map<NpcKind, Promise<Source | null>>();
let loader: GLTFLoader | null = null;

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

function asFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    if (!src.hasAttribute(key)) continue;
    const a = src.getAttribute(key), n = a.count, k = a.itemSize, out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = a.getComponent(i, j);
    g.setAttribute(key, new THREE.BufferAttribute(out, k));
  }
  const idx = src.getIndex();
  if (idx) g.setIndex(Array.from(idx.array));
  return g;
}

/** load one person's model (cached; null when it fails — the stand-in stays) */
export function loadNpcModel(kind: NpcKind): Promise<Source | null> {
  let p = loading.get(kind);
  if (!p) {
    if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
    p = loader.loadAsync(npcModelUrl(kind)).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const found: Source[] = [];
      gltf.scene.traverse((o) => {
        if (found.length > 0 || !isMesh(o)) return;
        const g = asFloat(o.geometry).applyMatrix4(o.matrixWorld);
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
        found.push({ geometry: g, map: std?.map ?? null, normalMap: std?.normalMap ?? null });
      });
      const hit = found[0] ?? null;
      if (hit !== null) sources.set(kind, hit);
      return hit;
    }).catch((e: unknown) => { console.warn(`[pine-hollow] npc model ${kind} failed`, e); return null; });
    loading.set(kind, p);
  }
  return p;
}

export function preloadNpcModels(): void {
  for (const k of NPC_KINDS) void loadNpcModel(k);
}

// ── the rig ──
const B = { hips: 0, spine: 1, chest: 2, neck: 3, head: 4, shR: 5, elR: 6, haR: 7, shL: 8, elL: 9, haL: 10 } as const;
const NAMES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderR', 'elbowR', 'handR', 'shoulderL', 'elbowL', 'handL'];
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9];

interface Built { geometry: THREE.BufferGeometry; rest: THREE.Vector3[]; height: number; lantern: THREE.Vector3 | null }
const built = new Map<NpcKind, Built>();

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** place the bones by the A-pose and weight every vertex (see the header) */
function rigOf(kind: NpcKind, src: Source): Built {
  const hit = built.get(kind);
  if (hit) return hit;
  const g = src.geometry.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox ?? new THREE.Box3();
  const H = bb.max.y - bb.min.y;
  const P = g.getAttribute('position'), n = P.count;
  // the torso's half-width at the chest: the median |x| of the vertices in a band at 70 % height, near the midline
  const band: number[] = [];
  for (let i = 0; i < n; i++) { const y = P.getY(i); if (Math.abs(y - 0.7 * H) < 0.03 * H) band.push(Math.abs(P.getX(i))); }
  band.sort((a, b) => a - b);
  const torsoW = Math.max(0.1 * H, (band[Math.floor(band.length * 0.5)] ?? 0.1 * H) * 1.05);
  const shY = 0.815 * H, shX = torsoW * 0.95, waist = 0.5 * H;
  // an arm vertex: outside the torso column, above the waist; its side by x (the person faces +z: their right is −x)
  const side = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i);
    const col = torsoW * (1.05 + 0.25 * smooth(shY, 0.6 * H, y));   // the column widens a little toward the hips (the coat)
    if (y > waist * 0.55 && y < shY + 0.04 * H && Math.abs(x) > col) side[i] = x < 0 ? -1 : 1;
  }
  const hand = (s: number): THREE.Vector3 => {
    const sh = new THREE.Vector3(s * shX, shY, 0), best = new THREE.Vector3(s * (shX + 0.1 * H), 0.45 * H, 0);
    let bd = 0;
    for (let i = 0; i < n; i++) {
      if (side[i] !== s) continue;
      const d = (P.getX(i) - sh.x) ** 2 + (P.getY(i) - sh.y) ** 2 + (P.getZ(i) - sh.z) ** 2;
      if (d > bd) { bd = d; best.set(P.getX(i), P.getY(i), P.getZ(i)); }
    }
    return best;
  };
  // the right hand: the arm's far point, but a hanging lantern would read as the hand — cap the arm at 0.4 H long
  const capArm = (s: number): THREE.Vector3 => {
    const sh = new THREE.Vector3(s * shX, shY, 0), h = hand(s), d = h.clone().sub(sh);
    return d.length() > 0.4 * H ? sh.clone().addScaledVector(d.normalize(), 0.36 * H) : h;
  };
  const hR = capArm(-1), hL = capArm(1);
  const rest: THREE.Vector3[] = [
    new THREE.Vector3(0, 0.53 * H, 0), new THREE.Vector3(0, 0.62 * H, 0), new THREE.Vector3(0, 0.72 * H, 0),
    new THREE.Vector3(0, 0.84 * H, 0), new THREE.Vector3(0, 0.88 * H, 0),
    new THREE.Vector3(-shX, shY, 0), new THREE.Vector3(-shX, shY, 0).lerp(hR, 0.5), hR,
    new THREE.Vector3(shX, shY, 0), new THREE.Vector3(shX, shY, 0).lerp(hL, 0.5), hL,
  ];
  // the lantern (the ranger's): the lowest arm-side vertex cluster below the right hand
  let lantern: THREE.Vector3 | null = null;
  if (kind === 'ranger') {
    let low = Infinity;
    for (let i = 0; i < n; i++) if (P.getX(i) < -torsoW * 1.2 && P.getY(i) < hR.y && P.getY(i) > 0.12 * H && P.getY(i) < low) low = P.getY(i);
    if (Number.isFinite(low)) lantern = new THREE.Vector3(hR.x, (low + hR.y) * 0.5, hR.z);
  }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const seg = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => { const ab = b.clone().sub(a); return Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()))); };
  const put = (i: number, a: number, wa: number, b: number, wb: number): void => { si[i * 4] = a; sw[i * 4] = wa; si[i * 4 + 1] = b; sw[i * 4 + 1] = wb; };
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    const s = side[i] ?? 0;
    if (s !== 0 || (kind === 'ranger' && lantern !== null && p.x < -torsoW * 1.2 && p.y < hR.y && p.y > 0.12 * H)) {
      const r = s >= 0 && s !== 0 ? 1 : -1;   // −1 = the right arm (and the lantern under it)
      const sh = rest[r < 0 ? B.shR : B.shL] ?? p, ha = rest[r < 0 ? B.haR : B.haL] ?? p;
      const t = p.y < ha.y && r < 0 ? 1 : seg(p, sh, ha);
      const bs = r < 0 ? B.shR : B.shL, be = r < 0 ? B.elR : B.elL, bh = r < 0 ? B.haR : B.haL;
      if (t < 0.15) put(i, B.chest, 1 - t / 0.15, bs, t / 0.15);
      else if (t < 0.5) { const k = smooth(0.35, 0.6, t); put(i, bs, 1 - k, be, k); }
      else { const k = smooth(0.85, 1, t); put(i, be, 1 - k, bh, k); }
      continue;
    }
    const y = p.y;
    if (y < 0.5 * H) put(i, B.hips, 1, B.spine, 0);
    else if (y < 0.64 * H) { const k = smooth(0.5 * H, 0.64 * H, y); put(i, B.hips, 1 - k, B.spine, k); }
    else if (y < 0.76 * H) { const k = smooth(0.64 * H, 0.76 * H, y); put(i, B.spine, 1 - k, B.chest, k); }
    else if (y < 0.86 * H) { const k = smooth(0.8 * H, 0.86 * H, y); put(i, B.chest, 1 - k, B.neck, k); }
    else { const k = smooth(0.86 * H, 0.89 * H, y); put(i, B.neck, 1 - k, B.head, k); }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.4;
  const out: Built = { geometry: g, rest, height: H, lantern };
  built.set(kind, out);
  return out;
}

export interface NpcRig {
  mesh: THREE.SkinnedMesh;
  /** the head's world point after posing (the talk prompt / bark) */
  readonly height: number;
  /** the ranger's lantern (mesh-local, rides the right hand), or null */
  readonly lanternAt: THREE.Vector3 | null;
  /** the right hand bone (a glow for the lantern hangs off it) */
  readonly handR: THREE.Bone;
  /**
   * pose the rig: `talk` 0 … 1 (eased by the caller), `point` 0 … 1 toward `pointYaw` (radians, mesh-local; 0 = ahead),
   * `look` the head's yaw toward the player (mesh-local)
   */
  pose: (t: number, talk: number, point: number, pointYaw: number, look: number) => void;
}

const sharedMats = new Map<NpcKind, THREE.MeshStandardMaterial>();
/** a skinned instance of `kind`'s model, or null until it has loaded */
export function npcRig(kind: NpcKind, sky: Sky): NpcRig | null {
  const src = sources.get(kind);
  if (!src) return null;
  const b = rigOf(kind, src);
  let mat = sharedMats.get(kind);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, normalScale: new THREE.Vector2(1, -1), roughness: 0.85, metalness: 0 });
    mat.name = `ph-npc-${kind}`;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    sky.setupMaterial(mat);
    sharedMats.set(kind, mat);
  }
  const bones = NAMES.map((name) => { const bone = new THREE.Bone(); bone.name = name; return bone; });
  bones.forEach((bone, i) => {
    const pi = PARENT[i] ?? -1, r = b.rest[i] ?? new THREE.Vector3();
    const pr = pi >= 0 ? b.rest[pi] ?? new THREE.Vector3() : new THREE.Vector3();
    bone.position.copy(r).sub(pr);
    if (pi >= 0) bones[pi]?.add(bone);
  });
  const mesh = new THREE.SkinnedMesh(b.geometry, mat);
  const root = bones[0];
  if (root) mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.receiveShadow = true;
  const bn = (i: number): THREE.Bone => bones[i] ?? new THREE.Bone();
  const hips = bn(B.hips), spine = bn(B.spine), chest = bn(B.chest), neck = bn(B.neck), head = bn(B.head);
  const shR = bn(B.shR), elR = bn(B.elR), shL = bn(B.shL), elL = bn(B.elL);
  return {
    mesh, height: b.height, lanternAt: b.lantern, handR: bn(B.haR),
    pose: (t, talk, point, pointYaw, look) => {
      const breathe = Math.sin(t * 1.6);
      hips.rotation.set(0, 0, 0.012 * Math.sin(t * 0.35));                     // a slow weight shift
      spine.rotation.set(0.01 * breathe, 0, -0.01 * Math.sin(t * 0.35));
      chest.rotation.set(-0.012 * breathe - 0.03 * talk * Math.max(0, Math.sin(t * 2.2)), 0, 0);
      const nod = talk * 0.07 * Math.sin(t * 3.1) * Math.max(0, Math.sin(t * 0.9));
      neck.rotation.set(0.02 + nod * 0.5, look * 0.45, 0);
      head.rotation.set(nod, look * 0.55, 0);
      // the arms: lowered from the A-pose toward the body (the right one less while it gestures / points)
      const lower = 0.42, gest = talk * (1 - point);
      shL.rotation.set(-0.05 * breathe, 0, -lower * 0.9);
      elL.rotation.set(-0.12 - 0.05 * talk, 0, 0);
      const g = gest * (0.5 + 0.5 * Math.sin(t * 2.4));
      shR.rotation.set(-0.25 * g - 1.35 * point, -pointYaw * point, lower * (1 - point) * (1 - 0.4 * g));
      elR.rotation.set(-0.15 - 0.9 * g - 0.1 * point, 0, 0);
    },
  };
}

// E155 (src/core/shardState.ts): the shared materials are set up for one shard's sky (its CSM, its fog) and the built figures
// wear them: per shard — an evicted Pine Hollow's must not be held. With KTX2 the loaded models too (a texture's mips leave
// JS once uploaded, so a rebuilt shard's renderer could not upload a cached copy).
mapSlot('npcModels.built', built); mapSlot('npcModels.mats', sharedMats);
if (MAY_KTX2) { mapSlot('npcModels.sources', sources); mapSlot('npcModels.loading', loading); }

/**
 * pineCreatures — Pine Hollow's generated creature hulls (PINE-HOLLOW-REMASTER PH-M1 / PH-M2, Jake's PH-U11), pre-skinned
 * to the procedural species' own skeletons, so the species' bones, gaits and AI drive them. On by default in Pine Hollow;
 * `?creatures=proc` keeps the procedural fur animals (the fallback).
 *
 *   await preloadPineCreatures();                                   // the animals boot step: every rig, before a herd spawns
 *   const h = skinPineHull(kind, variant, bones, eyes);             // null → keep the procedural mesh
 *   h.geometry (position, normal, uv, color, skinIndex, skinWeight[, aThrall]; one group)  h.map  h.normalMap  h.bones
 *
 * The rigs are baked offline by `scripts/creature-rig-bake.mjs --chunk pine-hollow` (src/entities/creatureRigBake.ts):
 * each photoreal TRELLIS.2 hull (art/pine-hollow/round-9-creature-refs/) fitted to its species' skeleton, its stance
 * un-posed to the rest pose, weighted along its own surface — `public/assets/pine-hollow/creatures/<hull>[.phone].rigged.glb`,
 * a glTF skin whose joints are the species' bones by name and order, with the hull's PBR base colour + normal map. A rig is
 * only used when its joint names match the variant's bones (in order); the model then takes the rig's joint positions.
 * Every variant of a hull wears it, in its own coat (pineCoats.ts). The King's thralls (VariantDef.traits.thrall, PH-M2)
 * also get glowing glass eyes and a few rigid fern clumps on the spine (`thrallExtras`): geometry in the same single draw,
 * flagged per vertex by `aThrall` (x = own vertex colour instead of the atlas, y = glow).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getActiveChunk } from '../chunks/registry';
import { pineCreatureRigUrl, PINE_CREATURE_RIGS, type PineRigName } from './pineCreatureRigs';
import { variantDef, type BoneDef, type VariantDef } from './species/registry';
import { pineCoatAtlas, type CoatSpec } from './pineCoats';
import { DEER_PALETTE } from './species/deer';
import { BOAR_PALETTE } from './species/boar';
import { ELK_PALETTE } from './species/elk';
import { BEAR_PALETTE } from './species/bear';

export type { PineRigName } from './pineCreatureRigs';

/** Pine Hollow's creatures are the rigged hulls, unless `?creatures=proc` (or the shard isn't Pine Hollow) */
export function pineCreaturesOn(): boolean {
  if (getActiveChunk().slug !== 'pine-hollow') return false;
  if (typeof location === 'undefined') return true;
  return new URLSearchParams(location.search).get('creatures') !== 'proc';
}

/** (kind:variant) → its hull; a variant missing here stays procedural */
const HULL: Readonly<Record<string, PineRigName>> = {
  'deer:hind': 'deer-hind', 'deer:white-hind': 'deer-hind', 'deer:piebald': 'deer-hind',
  'deer:stag': 'deer-stag', 'deer:white-stag': 'deer-stag', 'deer:big-stag': 'deer-stag', 'deer:ghost': 'deer-stag',
  'boar:boar': 'boar', 'boar:sow': 'boar', 'boar:black': 'boar', 'boar:big': 'boar', 'boar:scarback': 'boar', 'boar:ironhide': 'boar', 'boar:thrall': 'boar',
  'elk:cow': 'elk-cow', 'elk:pale': 'elk-cow',
  'elk:bull': 'elk-bull', 'elk:big-bull': 'elk-bull', 'elk:imperial': 'elk-bull', 'elk:thrall': 'elk-bull',
  'bear:black': 'bear-black', 'bear:black-blaze': 'bear-black', 'bear:black-old': 'bear-black',
  'bear:brown': 'bear-brown', 'bear:brown-old': 'bear-brown',
};

/** per hull: the species palette, the variant it was generated as, and the [dark, body, light] coat keys (pineCoats.ts) */
const COATS: Readonly<Record<PineRigName, CoatSpec>> = {
  'deer-hind': { palette: DEER_PALETTE, source: ['deer', 'hind'], keys: ['bodyDark', 'body', 'belly'] },
  'deer-stag': { palette: DEER_PALETTE, source: ['deer', 'stag'], keys: ['bodyDark', 'body', 'belly'] },
  boar: { palette: BOAR_PALETTE, source: ['boar', 'boar'], keys: ['dark', 'base', 'grizzle'] },
  'elk-cow': { palette: ELK_PALETTE, source: ['elk', 'cow'], keys: ['neck', 'body', 'rump'] },
  'elk-bull': { palette: ELK_PALETTE, source: ['elk', 'bull'], keys: ['neck', 'body', 'rump'] },
  'bear-black': { palette: BEAR_PALETTE, source: ['bear', 'black'], keys: ['dark', 'base', 'tip'] },
  'bear-brown': { palette: BEAR_PALETTE, source: ['bear', 'brown'], keys: ['dark', 'base', 'tip'] },
};

/** the hull for (kind, variant) when the generated creatures are on, else null */
export function pineHull(kind: string, variant: string): PineRigName | null {
  if (!pineCreaturesOn()) return null;
  return HULL[`${kind}:${variant}`] ?? null;
}

export interface PineRig {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  joints: { name: string; pos: THREE.Vector3 }[];
}
export interface PineHull {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  /** the skeleton the hull is bound to: the variant's bones at the rig's joint positions */
  bones: BoneDef[];
  /** a thrall: the geometry carries `aThrall` (the factory's glow patch reads it) */
  thrall: boolean;
}

let loader: GLTFLoader | null = null;
const loading = new Map<PineRigName, Promise<PineRig>>();
const ready = new Map<PineRigName, PineRig>();
const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

/** load one rig (cached): its geometry in the skeleton's rest space, its textures, the joints' rest positions */
export function loadPineRig(name: PineRigName): Promise<PineRig> {
  let p = loading.get(name);
  if (!p) {
    if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
    p = loader.loadAsync(pineCreatureRigUrl(name)).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const found: THREE.SkinnedMesh[] = [];
      gltf.scene.traverse((o) => { if (isSkinned(o)) found.push(o); });
      const sm = found[0];
      if (!sm) throw new Error(`creature rig ${name}: no skinned mesh`);
      const src = sm.geometry;
      const geometry = new THREE.BufferGeometry();
      for (const key of ['position', 'normal', 'uv', 'skinWeight'] as const) if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
      const si = src.getAttribute('skinIndex');
      const idx16 = new Uint16Array(si.count * 4);
      for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) idx16[i * 4 + c] = si.getComponent(i, c);
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx16, 4));
      const index = src.getIndex();
      if (index) geometry.setIndex(Array.from(index.array));
      const n = geometry.getAttribute('position').count;
      // the fur material reads vertex colours: white (the atlas carries the coat)
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      geometry.clearGroups(); geometry.addGroup(0, index ? index.count : n, 0);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.6; // animated legs / neck / corpse roll never leave this (as the procedural)
      const mat = Array.isArray(sm.material) ? sm.material[0] : sm.material;
      const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
      const map = std?.map ?? null, normalMap = std?.normalMap ?? null;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      if (normalMap) normalMap.anisotropy = 4;
      const joints = sm.skeleton.bones.map((b) => ({ name: b.name, pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) }));
      const out: PineRig = { geometry, map, normalMap, joints };
      ready.set(name, out);
      return out;
    });
    loading.set(name, p);
  }
  return p;
}

/** every Pine Hollow rig, loaded (failures are logged: those species stay procedural) */
export async function preloadPineCreatures(): Promise<void> {
  if (!pineCreaturesOn()) return;
  await Promise.all(PINE_CREATURE_RIGS.map((n) => loadPineRig(n).catch((e: unknown) => { console.warn(`[pine-hollow] creature rig ${n} failed`, e); })));
}

/** true when the rig's skin joints are `bones` by name, in order (their rest positions are the rig's) */
function jointsMatch(rig: PineRig, bones: readonly BoneDef[]): boolean {
  return rig.joints.length === bones.length && bones.every((b, i) => rig.joints[i]?.name === b.name);
}

/** the procedural eyes (AnimalSpecies.eyeParts): centre + radius of each, rest space */
export interface EyeSpot { centre: THREE.Vector3; radius: number }

const thrallGeo = new Map<string, THREE.BufferGeometry>();

/**
 * The rigged hull for (kind, variant), bound to `bones` (the variant's skeleton). Null when the generated creatures are
 * off, the variant has no hull, the rig hasn't loaded, or it was baked against other bones. `eyes`: the procedural eyes
 * (a thrall's glowing eyes are placed on the hull's surface nearest them).
 */
export function skinPineHull(kind: string, variant: string, bones: readonly BoneDef[], eyes: readonly EyeSpot[]): PineHull | null {
  const name = pineHull(kind, variant);
  if (name === null) return null;
  const rig = ready.get(name);
  if (!rig) return null;
  if (!jointsMatch(rig, bones)) { console.warn(`[pine-hollow] creature rig ${name}: baked against other bones than ${kind}:${variant} — re-run scripts/creature-rig-bake.mjs`); return null; }
  const out: BoneDef[] = bones.map((b, i) => { const p = rig.joints[i]?.pos; return { name: b.name, parent: b.parent, pos: p ? [p.x, p.y, p.z] : b.pos }; });
  const v = variantDef(kind, variant);
  const thrall = Boolean(v.traits?.['thrall']);
  const map = rig.map ? pineCoatAtlas(`${name}:${kind}:${variant}`, COATS[name], { geometry: rig.geometry, map: rig.map }, v, out) : null;
  let geometry = rig.geometry;
  if (thrall) {
    const key = `${name}:${kind}:${variant}`;
    let g = thrallGeo.get(key);
    if (!g) { g = withThrallExtras(rig.geometry, out, eyes, v); thrallGeo.set(key, g); }
    geometry = g;
  }
  return { geometry, map, normalMap: rig.normalMap, bones: out, thrall };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// The thralls' extras (PH-M2): glass eyes + fern clumps, rigid on one bone each
// ─────────────────────────────────────────────────────────────────────────────────────────

/** a part appended to the hull: positions / normals / colours, bound wholly to `bone`; own = 1 (vertex colour), glow */
interface Part { pos: number[]; nrm: number[]; col: number[]; idx: number[]; bone: number; glow: number }

const boneIdx = (bones: readonly BoneDef[], name: string): number => Math.max(0, bones.findIndex((b) => b.name === name));

/** the hull's vertex nearest `p` whose normal faces `dir` (dot > minDot) */
function nearestSurface(geo: THREE.BufferGeometry, p: THREE.Vector3, dir: THREE.Vector3 | null, minDot: number): { p: THREE.Vector3; n: THREE.Vector3 } | null {
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal');
  let best = -1, bd = Infinity;
  for (let i = 0; i < P.count; i++) {
    if (dir && N.getX(i) * dir.x + N.getY(i) * dir.y + N.getZ(i) * dir.z < minDot) continue;
    const d = (P.getX(i) - p.x) ** 2 + (P.getY(i) - p.y) ** 2 + (P.getZ(i) - p.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  return { p: new THREE.Vector3(P.getX(best), P.getY(best), P.getZ(best)), n: new THREE.Vector3(N.getX(best), N.getY(best), N.getZ(best)).normalize() };
}

/** the top of the hull's back at z (the highest vertex within ±w of the midline, ±dz of z) */
function backAt(geo: THREE.BufferGeometry, z: number, w: number, dz: number): THREE.Vector3 | null {
  const P = geo.getAttribute('position');
  let best = -1, by = -Infinity;
  for (let i = 0; i < P.count; i++) {
    if (Math.abs(P.getX(i)) > w || Math.abs(P.getZ(i) - z) > dz) continue;
    if (P.getY(i) > by) { by = P.getY(i); best = i; }
  }
  return best < 0 ? null : new THREE.Vector3(P.getX(best), P.getY(best), P.getZ(best));
}

/** a glowing glass eye: a small sphere sunk half into the hull's socket */
function eyePart(at: THREE.Vector3, n: THREE.Vector3, r: number, bone: number): Part {
  const s = new THREE.SphereGeometry(r, 10, 8);
  s.translate(at.x - n.x * r * 0.35, at.y - n.y * r * 0.35, at.z - n.z * r * 0.35);
  const P = s.getAttribute('position'), N = s.getAttribute('normal'), I = s.getIndex();
  const part: Part = { pos: [], nrm: [], col: [], idx: I ? Array.from(I.array) : [], bone, glow: 1 };
  for (let i = 0; i < P.count; i++) { part.pos.push(P.getX(i), P.getY(i), P.getZ(i)); part.nrm.push(N.getX(i), N.getY(i), N.getZ(i)); part.col.push(0.55, 0.95, 1.0); }
  s.dispose();
  return part;
}

/**
 * A fern clump: `fronds` pinnate fronds rising from `at` and arching outward — a rachis ribbon with leaflet triangles on
 * each side, both faces (the hull's material is single-sided). Solid geometry, no alpha: it stays in the one draw and
 * casts the same depth as the body.
 */
function fernPart(at: THREE.Vector3, up: THREE.Vector3, size: number, fronds: number, seed: number, bone: number): Part {
  const part: Part = { pos: [], nrm: [], col: [], idx: [], bone, glow: 0 };
  let s = seed;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const side = new THREE.Vector3(), fwd = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3(), nn = new THREE.Vector3(), out = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: [number, number, number]): void => {
    nn.subVectors(b, a).cross(t.subVectors(c, a)).normalize();
    const base = part.pos.length / 3;
    for (const v of [a, b, c]) { part.pos.push(v.x, v.y, v.z); part.nrm.push(nn.x, nn.y, nn.z); part.col.push(...col); }
    part.idx.push(base, base + 1, base + 2);
    const back = part.pos.length / 3;   // the other face
    for (const v of [a, c, b]) { part.pos.push(v.x, v.y, v.z); part.nrm.push(-nn.x, -nn.y, -nn.z); part.col.push(...col); }
    part.idx.push(back, back + 1, back + 2);
  };
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rnd() * 0.8;
    out.set(Math.cos(ang), 0, Math.sin(ang));
    const len = size * (0.7 + 0.5 * rnd()), lift = 0.9 + 0.5 * rnd();
    const green: [number, number, number] = [0.09 + 0.05 * rnd(), 0.2 + 0.08 * rnd(), 0.05 + 0.03 * rnd()];
    const SEG = 7;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG;
      // up first, then out and drooping at the tip
      pts.push(new THREE.Vector3().copy(at).addScaledVector(up, len * (lift * u - 0.9 * u * u)).addScaledVector(out, len * u * 0.95));
    }
    for (let k = 0; k < SEG; k++) {
      const a = pts[k], b = pts[k + 1];
      if (!a || !b) continue;
      const u = (k + 0.5) / SEG;
      fwd.subVectors(b, a).normalize();
      side.crossVectors(fwd, up).normalize();
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      const leaf = len * 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.3 * u);
      const tip: [number, number, number] = [green[0] + 0.1 * u, green[1] + 0.06 * u, green[2]];
      for (const sgn of [1, -1]) {
        // a leaflet: from the rachis, angled forward and down
        q.copy(a).addScaledVector(side, sgn * leaf).addScaledVector(fwd, leaf * 0.45).addScaledVector(up, -leaf * 0.25);
        tri(a, b, q, tip);
      }
      // the rachis itself, a thin ribbon
      q.copy(b).addScaledVector(side, len * 0.012);
      tri(a, b, q, [0.12, 0.16, 0.06]);
    }
  }
  return part;
}

/** the hull geometry + a thrall's eyes and fern clumps, `aThrall` = (own colour, glow) per vertex */
function withThrallExtras(hull: THREE.BufferGeometry, bones: readonly BoneDef[], eyes: readonly EyeSpot[], v: VariantDef): THREE.BufferGeometry {
  const box = hull.boundingBox ?? new THREE.Box3().setFromBufferAttribute(hull.getAttribute('position') as THREE.BufferAttribute);
  const H = box.max.y - box.min.y, halfW = Math.max(0.05, (box.max.x - box.min.x) * 0.5);
  const parts: Part[] = [];
  const head = boneIdx(bones, 'head');
  for (const e of eyes) {
    const dir = new THREE.Vector3(Math.sign(e.centre.x) || 1, 0.1, 0.35).normalize();
    const hit = nearestSurface(hull, e.centre, dir, 0.15);
    if (hit) parts.push(eyePart(hit.p, hit.n, e.radius * 1.25, head));
  }
  const body = bones.find((b) => b.name === 'body'), neck = bones.find((b) => b.name === 'neck1');
  if (body && neck) {
    const up = new THREE.Vector3(0, 1, 0);
    const size = H * 0.28 * Number(v.traits?.['fern'] ?? 1);   // traits.fern: the clumps' size (1 = 28 % of the height)
    // withers (on neck1), mid-back and rump (on the body): the clumps ride the spine bones rigidly
    const spots: [number, string, number][] = [[neck.pos[2] - 0.1 * H, 'neck1', 6], [body.pos[2] + 0.05 * H, 'body', 5], [body.pos[2] - 0.35 * H, 'body', 4]];
    spots.forEach(([z, bone, fronds], k) => {
      const top = backAt(hull, z, halfW * 0.35, 0.06 * H);
      if (top) parts.push(fernPart(top.addScaledVector(up, -0.01 * H), up, size * (k === 0 ? 1.1 : 0.9), fronds, 977 + k * 131, boneIdx(bones, bone)));
    });
  }
  // merge: the hull's attributes + the parts (uv: a small patch — the aThrall.x = 1 texels ignore the atlas and its normals)
  const n0 = hull.getAttribute('position').count;
  const extra = parts.reduce((s, p) => s + p.pos.length / 3, 0);
  const n = n0 + extra;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), thr = new Float32Array(n * 2);
  const copy = (name: string, dst: Float32Array | Uint16Array, k: number): void => { const a = hull.getAttribute(name); for (let i = 0; i < n0; i++) for (let c = 0; c < k; c++) dst[i * k + c] = a.getComponent(i, c); };
  copy('position', pos, 3); copy('normal', nrm, 3); copy('uv', uv, 2); copy('skinIndex', si, 4); copy('skinWeight', sw, 4);
  const idx: number[] = Array.from(hull.getIndex()?.array ?? []);
  let o = n0;
  for (const p of parts) {
    const m = p.pos.length / 3;
    for (let i = 0; i < m; i++) {
      const j = o + i;
      for (let c = 0; c < 3; c++) { pos[j * 3 + c] = p.pos[i * 3 + c] ?? 0; nrm[j * 3 + c] = p.nrm[i * 3 + c] ?? 0; col[j * 3 + c] = p.col[i * 3 + c] ?? 1; }
      uv[j * 2] = 0.5 + 0.01 * (i % 7); uv[j * 2 + 1] = 0.5 + 0.01 * ((i * 3) % 5);
      si[j * 4] = p.bone; sw[j * 4] = 1;
      thr[j * 2] = 1; thr[j * 2 + 1] = p.glow;
    }
    for (const t of p.idx) idx.push(o + t);
    o += m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aThrall', new THREE.BufferAttribute(thr, 2));
  g.setIndex(idx);
  g.addGroup(0, idx.length, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  if (g.boundingSphere !== null) g.boundingSphere.radius += 0.6;
  return g;
}

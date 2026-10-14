import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { Rng } from '@wildshard/engine/core/rng';
import type { BoneDef, SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import { ELK } from '@wildshard/game/systems/species/elk';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { PINE_HULLS } from '../data/creatureHulls';

/**
 * Pine Hollow's thralls' extras, baked offline (SHARD-PLATFORM W2 C2; was runtime/looks/riggedHulls.ts): each thrall
 * (`boar:thrall`, `elk:thrall`) wears glowing glass eyes and a few rigid fern clumps on its spine, placed on its tier's
 * rigged hull. This runs the same placement the page ran on the same loaded rig (three's GLTFLoader, `readSourceModel`)
 * and writes the parts as one static GLB per tier (`bake-pine-thrall-extras.mjs`); the page appends them to the hull
 * (`@wildshard/sdk/looks/riggedHulls` `parts`). Each part vertex carries `_bone` (its one rigid bone) and `_glow`.
 */

/** the thralls the bake covers: [kind, variant id, the variant's traits as the look declares them] */
const THRALLS: readonly (readonly [string, string, Readonly<Record<string, number>>])[] = [
  ['boar', 'thrall', { tuskScale: 1.4, thrall: 1 }],
  ['elk', 'thrall', { antlers: 1, thrall: 1 }],
];

/** the procedural species whose eye spots a thrall's glass eyes go on */
const BUILDS: Readonly<Record<string, Pick<SpeciesDef, 'build'>>> = { boar: BOAR_LOOK, elk: ELK };

/** the page's model seed (AnimalFactory `hashSeed`) */
function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.codePointAt(i) ?? 0; h = Math.imul(h, 16777619); } return h >>> 0; }

interface EyeSpot { centre: THREE.Vector3; radius: number }

/** a variant's procedural eye spots (the bounding spheres of its species build's eye parts, as the page reads them) */
function eyeSpots(kind: string, variant: string, traits: Readonly<Record<string, number>>): EyeSpot[] {
  const builder = BUILDS[kind];
  if (builder === undefined) throw new Error(`thrall extras: no species build for ${kind}`);
  const v: VariantDef = { id: variant, label: variant, weight: 1, rarity: 'rare', scale: [1, 1], hp: 1, traits: { ...traits } };
  const sp = builder.build(v, new Rng(hashSeed(`${kind}:${variant}`)));
  const eyes: EyeSpot[] = [];
  for (const g of sp.eyeParts) { g.computeBoundingSphere(); const bs = g.boundingSphere; if (bs !== null) eyes.push({ centre: bs.center.clone(), radius: bs.radius }); }
  for (const g of [...sp.furParts, ...sp.hardParts, ...sp.eyeParts]) g.dispose();
  return eyes;
}

/** a part appended to the hull: positions / normals / colours, bound wholly to `bone`; glow */
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

/** a thrall's eyes and fern clumps on its hull, as one geometry: position, normal, uv, color, `_bone`, `_glow` */
function thrallParts(hull: THREE.BufferGeometry, bones: readonly BoneDef[], eyes: readonly EyeSpot[], traits: Readonly<Record<string, number>>): THREE.BufferGeometry {
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
    const size = H * 0.28 * (traits['fern'] ?? 1);   // traits.fern: the clumps' size (1 = 28 % of the height)
    // withers (on neck1), mid-back and rump (on the body): the clumps ride the spine bones rigidly
    const spots: [number, string, number][] = [[neck.pos[2] - 0.1 * H, 'neck1', 6], [body.pos[2] + 0.05 * H, 'body', 5], [body.pos[2] - 0.35 * H, 'body', 4]];
    spots.forEach(([z, bone, fronds], k) => {
      const top = backAt(hull, z, halfW * 0.35, 0.06 * H);
      if (top) parts.push(fernPart(top.addScaledVector(up, -0.01 * H), up, size * (k === 0 ? 1.1 : 0.9), fronds, 977 + k * 131, boneIdx(bones, bone)));
    });
  }
  const n = parts.reduce((s, p) => s + p.pos.length / 3, 0);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), bone = new Float32Array(n), glow = new Float32Array(n);
  const idx: number[] = [];
  let o = 0;
  for (const p of parts) {
    const m = p.pos.length / 3;
    for (let i = 0; i < m; i++) {
      const j = o + i;
      for (let c = 0; c < 3; c++) { pos[j * 3 + c] = p.pos[i * 3 + c] ?? 0; nrm[j * 3 + c] = p.nrm[i * 3 + c] ?? 0; col[j * 3 + c] = p.col[i * 3 + c] ?? 1; }
      // uv: a small patch (the parts' texels take their own colour, never the atlas)
      uv[j * 2] = 0.5 + 0.01 * (i % 7); uv[j * 2 + 1] = 0.5 + 0.01 * ((i * 3) % 5);
      bone[j] = p.bone; glow[j] = p.glow;
    }
    for (const t of p.idx) idx.push(o + t);
    o += m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('bone', new THREE.BufferAttribute(bone, 1));
  g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
  g.setIndex(idx);
  return g;
}

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;

/** one baked thrall: its node name in the GLB (`<kind>_<variant>`) and its parts */
export interface ThrallPartsBake { readonly name: string; readonly geometry: THREE.BufferGeometry }

/** every thrall's parts on `tier`'s hulls; `rig(file)` returns a retained rig GLB's bytes (`<hull>[.phone].rigged.glb`) */
export async function bakeThrallParts(rig: (file: string) => Promise<Uint8Array>, tier: 'phone' | 'desktop'): Promise<ThrallPartsBake[]> {
  const out: ThrallPartsBake[] = [];
  for (const [kind, variant, traits] of THRALLS) {
    const hullName = PINE_HULLS.hulls[`${kind}:${variant}`];
    if (hullName === undefined) throw new Error(`thrall extras: ${kind}:${variant} wears no hull`);
    if (PINE_HULLS.flaps?.[hullName] !== undefined) throw new Error(`thrall extras: ${hullName} has a flap; press it before placing the parts`);
    const { gltf } = await readSourceModel(await rig(`${hullName}${tier === 'phone' ? '.phone' : ''}.rigged.glb`));
    gltf.scene.updateMatrixWorld(true);
    const found: THREE.SkinnedMesh[] = [];
    gltf.scene.traverse((o) => { if (isSkinned(o)) found.push(o); });
    const skinned = found[0];
    if (skinned === undefined) throw new Error(`thrall extras: ${hullName} has no skinned mesh`);
    // the hull as the page holds it: float positions + normals, its bounding box
    const hull = new THREE.BufferGeometry();
    for (const key of ['position', 'normal'] as const) {
      const a = skinned.geometry.getAttribute(key), arr = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
      hull.setAttribute(key, new THREE.BufferAttribute(arr, a.itemSize));
    }
    hull.computeBoundingBox();
    // the page's bones: the rig's joints (by name, in order) at their world rest positions
    const bones: BoneDef[] = skinned.skeleton.bones.map((b) => {
      const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
      return { name: b.name, parent: null, pos: [p.x, p.y, p.z] };
    });
    out.push({ name: `${kind}_${variant}`, geometry: thrallParts(hull, bones, eyeSpots(kind, variant, traits), traits) });
    hull.dispose();
  }
  return out;
}

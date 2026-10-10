import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { CreatureHull, EyeSpot } from '@wildshard/engine/entities/species/look';
import { variantDef, type BoneDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
/**
 * riggedHulls — a shard's generated creature hulls, pre-skinned to the procedural species' own skeletons, so the species'
 * bones, gaits and AI drive them (SHARD-PLATFORM M3: one generic family; a shard declares its row, `RiggedHullsRow`).
 *
 *   const family = riggedHulls(row, { rig: (hull) => url, coat: (hull, kind, variant) => key });
 *   await family.preload();                                  // every rig, before a herd spawns (a look's `preload`)
 *   const h = family.skin(kind, variant, bones, eyes, def);  // null → keep the procedural mesh (a look's `skin`)
 *   h.geometry (position, normal, uv, color, skinIndex, skinWeight[, aOvergrown]; one group)  h.map  h.normalMap  h.bones
 *
 * Each rig (`<hull>[.phone].rigged.glb`, baked offline by `scripts/creature-rig-bake.mjs`) is a glTF skin whose joints are
 * the species' bones by name and order, with the hull's PBR base colour + normal map. A rig is only used when its joint
 * names match the variant's bones (in order); the model then takes the rig's joint positions. Every variant of a hull
 * wears it, in its own coat (`coatAtlas`). A hull's generator flap (the row's `flaps`) is pressed onto its body at load
 * (positions + normals only; its texels take the rump's colour). A thrall (VariantDef.traits.thrall) also gets glowing
 * glass eyes and a few rigid fern clumps on the spine: geometry in the same single draw, flagged per vertex by
 * `aOvergrown` (x = own vertex colour instead of the atlas, y = glow).
 */
import * as THREE from 'three';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { adoptCoat, coatAtlas, coatAtlasSliced, coatsPainted, type CoatSpec } from './coatAtlas';
import type { HullFlapRow, HullPalette, RiggedHullsRow } from './riggedHullRows';
import { DEER_PALETTE } from '../species/deer';
import { ELK_PALETTE } from '../species/elk';
import { BEAR_PALETTE } from '../species/view/bear';
import { BOAR_PALETTE } from '../species/view/boar';

const PALETTES: Readonly<Record<HullPalette, Readonly<Record<string, RGB>>>> = { deer: DEER_PALETTE, elk: ELK_PALETTE, bear: BEAR_PALETTE, boar: BOAR_PALETTE };

/** Where a family's files are: a hull's rig for this tier, and a baked coat's KTX2 table key. */
export interface RiggedHullUrls {
  rig: (hull: string) => string;
  coat: (hull: string, kind: string, variant: string) => string;
}

/** A shard's live rigged-hull family. */
export interface RiggedHulls {
  /** the hull for (kind, variant), or null */
  hullOf: (kind: string, variant: string) => string | null;
  /** every rig loaded (failures are logged: those species stay procedural); on the KTX2 path every baked coat adopted */
  preload: () => Promise<void>;
  /** the rigged hull for (kind, variant) bound to `bones`, or null (no hull, not loaded, or baked against other bones) */
  skin: (kind: string, variant: string, bones: readonly BoneDef[], eyes: readonly EyeSpot[], definition?: VariantDef) => CreatureHull | null;
  /** the coat bake's source: every coat that repaints its hull, as a lossless PNG data URL keyed by its KTX2 table name */
  coatSources: () => { url: string; png: string }[];
  /** resolves once every coat `skin` started is painted (`skin` paints a new coat in slices; a look's `settle`) */
  painted: () => Promise<void>;
}

interface Rig {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  joints: { name: string; pos: THREE.Vector3 }[];
  /** per vertex, 1 where a generator's flap was pressed onto the body (null: none) */
  flap: Uint8Array | null;
}

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

/** A family of rigged hulls from its row. */
export function riggedHulls(row: RiggedHullsRow, urls: RiggedHullUrls): RiggedHulls {
  const adopting = new WeakMap<Rig, Promise<void>>();
  const loading = new Map<string, Promise<Rig>>();
  const ready = new Map<string, Rig>();
  const thrallGeo = new Map<string, THREE.BufferGeometry>();

  const hullOf = (kind: string, variant: string): string | null => row.hulls[`${kind}:${variant}`] ?? null;

  /** the coat spec of hull `name` */
  const coatSpec = (name: string): CoatSpec => {
    const c = row.coats[name];
    if (c === undefined) throw new Error(`rigged hull ${name}: no coat`);
    return { palette: PALETTES[c.palette], source: c.source, keys: c.keys, ...(c.measured === undefined ? {} : { measured: c.measured }) };
  };

  /** load one rig (cached): its geometry in the skeleton's rest space, its textures, the joints' rest positions */
  const loadRig = (name: string): Promise<Rig> => {
    let p = loading.get(name);
    if (!p) {
      p = loadRigFile(urls.rig(name)).then((gltf) => {
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
        // a generator flap pressed onto the body — positions + normals only, the skin untouched
        let flap: Uint8Array | null = null;
        const trim = row.flaps?.[name];
        if (trim !== undefined) {
          const pa = geometry.getAttribute('position').array, na = geometry.getAttribute('normal').array, ia = geometry.getIndex()?.array;
          if (pa instanceof Float32Array && na instanceof Float32Array && ia !== undefined) flap = pressFlap(pa, na, ia, trim);
        }
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
        const out: Rig = { geometry, map, normalMap, joints, flap };
        retainCachedResources(out);
        cacheUntilDisposed(out, () => {
          if (ready.get(name) === out) { ready.delete(name); loading.delete(name); }
          adopting.delete(out);
        });
        ready.set(name, out);
        return out;
      });
      loading.set(name, p);
    }
    return p;
  };

  /**
   * On the KTX2 path the hull's atlas is a compressed texture (no pixels to recolour), so each coat comes baked
   * (scripts/bake-coats.mjs: coatAtlas's own canvas, per tier, as UASTC KTX2) and is adopted under coatAtlas's key. A coat
   * with no stand-in keeps the hull's own.
   */
  const adoptBakedCoats = async (name: string, rig: Rig): Promise<void> => {
    const map = rig.map;
    if (map === null) return;
    await Promise.all(Object.entries(row.hulls).filter(([, hull]) => hull === name).map(async ([kv]) => {
      const [kind = '', variant = ''] = kv.split(':');
      const tex = await ktx2Texture(urls.coat(name, kind, variant));
      if (tex === null) return;
      tex.flipY = map.flipY; tex.anisotropy = map.anisotropy; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
      tex.name = `${map.name}:${name}:${kv}`;
      cacheUntilDisposed(tex, () => { adopting.delete(rig); });
      adoptCoat(`${name}:${kv}`, retainCachedResources(tex));
    }));
  };

  /** each loaded rig's coats are adopted once: a later visit's preload reuses them instead of retaining a fresh set */
  const adoptOnce = (name: string, rig: Rig): Promise<void> => {
    let p = adopting.get(rig);
    if (p === undefined) { p = adoptBakedCoats(name, rig); adopting.set(rig, p); }
    return p;
  };

  const preload = async (): Promise<void> => {
    await Promise.all(row.rigs.map((n) => loadRig(n).then((rig) => (rig.map instanceof THREE.CompressedTexture ? adoptOnce(n, rig) : undefined))
      .catch((e: unknown) => { console.warn(`[${row.label}] creature rig ${n} failed`, e); })));
  };

  const coatSources = (): { url: string; png: string }[] => {
    const out: { url: string; png: string }[] = [];
    for (const [kv, name] of Object.entries(row.hulls)) {
      const rig = ready.get(name), map = rig?.map ?? null;
      if (!rig || map === null) continue;
      const [kind = '', variant = ''] = kv.split(':');
      const bones: BoneDef[] = rig.joints.map((j) => ({ name: j.name, parent: null, pos: [j.pos.x, j.pos.y, j.pos.z] }));
      const tex = coatAtlas(`${name}:${kv}`, coatSpec(name), { geometry: rig.geometry, map, flap: rig.flap }, variantDef(kind, variant), bones);
      if (tex !== map && tex.image instanceof HTMLCanvasElement) out.push({ url: urls.coat(name, kind, variant), png: tex.image.toDataURL('image/png') });
    }
    return out;
  };

  const skin = (kind: string, variant: string, bones: readonly BoneDef[], eyes: readonly EyeSpot[], definition?: VariantDef): CreatureHull | null => {
    const name = hullOf(kind, variant);
    if (name === null) return null;
    const rig = ready.get(name);
    if (!rig) return null;
    if (!jointsMatch(rig, bones)) { console.warn(`[${row.label}] creature rig ${name}: baked against other bones than ${kind}:${variant} — re-run scripts/creature-rig-bake.mjs`); return null; }
    const out: BoneDef[] = bones.map((b, i) => { const p = rig.joints[i]?.pos; return { name: b.name, parent: b.parent, pos: p ? [p.x, p.y, p.z] : b.pos }; });
    const v = definition ?? variantDef(kind, variant);
    const thrall = Boolean(v.traits?.['thrall']);
    const map = rig.map ? coatAtlasSliced(`${name}:${kind}:${variant}`, coatSpec(name), { geometry: rig.geometry, map: rig.map, flap: rig.flap }, v, out) : null;
    let geometry = rig.geometry;
    if (thrall) {
      const key = `${name}:${kind}:${variant}`;
      let g = thrallGeo.get(key);
      if (!g) { g = withThrallExtras(rig.geometry, out, eyes, v); thrallGeo.set(key, g); }
      geometry = g;
    }
    const f = row.fur?.[name]?.[variant];
    const fur = f === undefined ? undefined : { rim: [f.rim[0], f.rim[1], f.rim[2]] satisfies RGB, sheenColor: [f.sheenColor[0], f.sheenColor[1], f.sheenColor[2]] satisfies RGB };
    return { geometry, map, normalMap: rig.normalMap, bones: out, overgrown: thrall, ...(fur !== undefined ? { fur } : {}) };
  };

  return { hullOf, preload, skin, coatSources, painted: coatsPainted };
}

/** true when the rig's skin joints are `bones` by name, in order (their rest positions are the rig's) */
function jointsMatch(rig: Rig, bones: readonly BoneDef[]): boolean {
  return rig.joints.length === bones.length && bones.every((b, i) => rig.joints[i]?.name === b.name);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// A generator flap, pressed onto the body
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Collapse a generator's flap in place. A flap is not a separate part — it IS the surface pulled back and down (deleting
 * its triangles leaves a hole), so it is collapsed, not cut: every vertex above `yMin` behind the back plane is pressed
 * onto that plane, keeping `keep` of its depth (the flap's outer surface stays outermost, so the pressed layers never
 * fight). Topology, uvs, skin indices and weights are untouched — only positions move, and the moved vertices' normals are
 * re-derived from their faces. Returns the pressed vertices (1 = moved), or null when none moved.
 */
export function pressFlap(pos: Float32Array, nrm: Float32Array, index: ArrayLike<number>, t: HullFlapRow): Uint8Array | null {
  const n = pos.length / 3;
  const moved = new Uint8Array(n);
  const plane = (y: number): number => t.z0 + (y - t.y0) * t.slope;
  let count = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0;
    if (y < t.yMin || z >= plane(y)) continue;
    moved[i] = 1;
    count++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (count === 0) return null;
  // the patch's ellipse (its x / y extent): the dome is `bulge` at the centre, 0 at the rim
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = Math.max(0.02, (x1 - x0) / 2), hy = Math.max(0.02, (y1 - y0) / 2);
  for (let i = 0; i < n; i++) {
    if (moved[i] !== 1) continue;
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0, zp = plane(y);
    const r2 = ((x - cx) / hx) ** 2 + ((y - cy) / hy) ** 2;
    pos[i * 3 + 2] = zp - (zp - z) * t.keep - t.bulge * Math.max(0, 1 - r2);
  }
  // welded ids (positions to 0.1 mm), so a seam's split vertices share one normal
  const ids = weldIds(pos);
  let nWeld = 0;
  for (let i = 0; i < n; i++) nWeld = Math.max(nWeld, (ids[i] ?? 0) + 1);
  const hit = new Uint8Array(nWeld);
  for (let i = 0; i < n; i++) if (moved[i] === 1) hit[ids[i] ?? 0] = 1;
  const acc = new Float64Array(nWeld * 3);
  for (let f = 0; f + 2 < index.length; f += 3) {
    const a = index[f] ?? 0, b = index[f + 1] ?? 0, c = index[f + 2] ?? 0;
    if (hit[ids[a] ?? 0] !== 1 && hit[ids[b] ?? 0] !== 1 && hit[ids[c] ?? 0] !== 1) continue;
    const ax = pos[a * 3] ?? 0, ay = pos[a * 3 + 1] ?? 0, az = pos[a * 3 + 2] ?? 0;
    const ux = (pos[b * 3] ?? 0) - ax, uy = (pos[b * 3 + 1] ?? 0) - ay, uz = (pos[b * 3 + 2] ?? 0) - az;
    const vx = (pos[c * 3] ?? 0) - ax, vy = (pos[c * 3 + 1] ?? 0) - ay, vz = (pos[c * 3 + 2] ?? 0) - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { const o = (ids[v] ?? 0) * 3; acc[o] = (acc[o] ?? 0) + nx; acc[o + 1] = (acc[o + 1] ?? 0) + ny; acc[o + 2] = (acc[o + 2] ?? 0) + nz; }
  }
  for (let i = 0; i < n; i++) {
    const id = ids[i] ?? 0;
    if (hit[id] !== 1) continue;
    const x = acc[id * 3] ?? 0, y = acc[id * 3 + 1] ?? 0, z = acc[id * 3 + 2] ?? 0, l = Math.hypot(x, y, z);
    if (l < 1e-12) continue;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  return moved;
}

/** per vertex, an id shared by every vertex at the same position (to 0.1 mm): the uv seams' split copies weld */
function weldIds(pos: ArrayLike<number>): Int32Array {
  const n = Math.floor(pos.length / 3), ids = new Int32Array(n), weld = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round((pos[i * 3] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 1] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 2] ?? 0) * 1e4)}`;
    let id = weld.get(k);
    if (id === undefined) { id = weld.size; weld.set(k, id); }
    ids[i] = id;
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// The thralls' extras: glass eyes + fern clumps, rigid on one bone each
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

/** the hull geometry + a thrall's eyes and fern clumps, `aOvergrown` = (own colour, glow) per vertex */
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
  // merge: the hull's attributes + the parts (uv: a small patch — the aOvergrown.x = 1 texels ignore the atlas and its normals)
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
  g.setAttribute('aOvergrown', new THREE.BufferAttribute(thr, 2));
  g.setIndex(idx);
  g.addGroup(0, idx.length, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  if (g.boundingSphere !== null) g.boundingSphere.radius += 0.6;
  return g;
}

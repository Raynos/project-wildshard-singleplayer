/**
 * PineCrags — the Ridge's granite and the Den's bear cave (PINE-HOLLOW-REMASTER PH-B2).
 *
 * The Ridge's face was the heightfield with a rock splat: smooth grey slopes. Now a kit of jointed granite built in
 * Blender (scripts/blender/crags/build_crags.py → public/assets/models/pine-hollow-crags/crags.glb: cliff bands, a
 * buttress, an exfoliation slab, two tors, three boulders, two scree patches, each a LOD0 + LOD1 with Cycles vertex AO)
 * is placed over it by `placeCrags` (pure, seeded — the navmesh bake runs the same code): cliff modules on every steep
 * face of the Ridge, the pass and the Den's walls, fronts turned down the slope and sunk into it; tors along the crest;
 * talus below each cliff where the slope eases — boulders and scree fans. The cave (build_cave.py → cave.glb) is one
 * merged interior behind the hero arch at the Den's mouth: an antechamber, a squeeze, the bear's room with its bedding
 * and bones, drips, and a crack in the roof whose shaft of light falls on the floor; its hood is the rock over its first
 * metres where the passage runs shallower than the slope.
 *
 * Draws: ONE BatchedMesh (WEBGL_multi_draw) for everything — every module's two LODs, the cave, its far hood — so the
 * crags cost one draw + one per shadow cascade; per instance, the LOD is a geometry id and the range a visibility bit,
 * and three culls each live instance against every camera it renders. The shaft and the drips are drawn only near the
 * cave. One program (+ its depth program): triplanar granite in world space (Poly Haven CC0 `mossy_rock`, the lichened
 * boreal granite), ledge grit from the terrain's own `rock_ground`, moss on the up-facing, rain streaks down the faces;
 * the vertex colour carries (AO → the indirect light, sun reach → the directional light only (the cave's lantern and
 * the lamps stay), wet, rock / tint).
 *
 * `?crags=v1` keeps the Ridge as it was (no crags, no talus); the cave stays (it is a place, not a look).
 *
 *   const crags = await PineCrags.load(sky);                        // null: the kit is missing (a dev server without it)
 *   crags.build(placeCrags({ trees }));  scene.add(crags.group);  registry.add({ colliders: crags.colliders, … })
 *   cutTerrain(physics, crags.terrainCuts()); terrain.punch(crags.holeTest());  game.onUpdate(() => crags.update(t))
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk } from './Heightfield';
import {
  BEAR_CAVE, DEN, LOOKOUT, ZIPLINE, WATERFALL, RIDGE_STREAM, POND, RIDGE, CABIN_SITES, ridgeFootZ, nearestOnPolyline, type XZ,
} from '../chunks/pineHollowLayout';
import type { ColliderDesc } from './registry';
import type { TerrainCut } from '../physics/terrain';
import { attachFogUniforms } from './Atmosphere';
import { loadPBR, type PBRSet } from '../core/assets';
import { TIER } from '../core/tier';
import { Rng } from '../core/rng';
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '../core/config';
import type { Sky } from './Sky';
import { PINE_CRAG_DIR } from './pineHero';

const CRAG_DIR = PINE_CRAG_DIR; // the files: pineHero.ts `PINE_CRAG_URLS` (the boot manifest lists them with the landmarks' props)

/** `?crags=v1`: the Ridge before PH-B2 (the taste rule: today's look stays selectable) */
export function cragsMode(): 'v2' | 'v1' {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('crags');
  return q === 'v1' ? 'v1' : 'v2';
}

/** the kit's modules (crags.glb nodes `<id>` and `<id>-lod1`) */
export const CRAG_IDS = ['cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab', 'tor-a', 'tor-b', 'boulder-a', 'boulder-b', 'boulder-c', 'scree-a', 'scree-b'] as const;
export type CragId = (typeof CRAG_IDS)[number];
const CLIFFS: readonly CragId[] = ['cliff-a', 'cliff-b', 'cliff-c', 'cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab'];
const TORS: readonly CragId[] = ['tor-a', 'tor-b'];
const BOULDERS: readonly CragId[] = ['boulder-a', 'boulder-b', 'boulder-c'];
const SCREES: readonly CragId[] = ['scree-a', 'scree-b'];

/** a module's footprint in its own frame (metres, before the placement's scale): half width (x), half depth (z), height */
export interface CragSize { hw: number; hd: number; h: number }
/** one placed module: position (its base centre), a turn about +Y (its front, local +Z, faces (sin yaw, cos yaw)), a tilt */
export interface CragPlace { id: CragId; x: number; y: number; z: number; yaw: number; scale: number; tiltX: number; tiltZ: number }

// ─────────────────────────────── placement (pure: the game and the navmesh bake run it) ───────────────────────────────

const ss = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** the cave's frame: its mouth at BEAR_CAVE, local +Z into the rock (the mouth faces local −Z), y is world height */
export const CAVE_FRAME = { x: BEAR_CAVE.x, z: BEAR_CAVE.z, yaw: BEAR_CAVE.rot };
/** world (x, z) → cave-local (lx, lz) */
export function caveLocal(x: number, z: number): [number, number] {
  const c = Math.cos(CAVE_FRAME.yaw), s = Math.sin(CAVE_FRAME.yaw), dx = x - CAVE_FRAME.x, dz = z - CAVE_FRAME.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** cave-local (lx, lz) → world (x, z) */
export function caveWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(CAVE_FRAME.yaw), s = Math.sin(CAVE_FRAME.yaw);
  return [CAVE_FRAME.x + lx * c + lz * s, CAVE_FRAME.z - lx * s + lz * c];
}

/** metres from (x, z) to the segment a–b */
function segDist(x: number, z: number, a: XZ, b: XZ): number { return nearestOnPolyline([a, b], x, z).d; }

/**
 * Where nothing of the kit may stand (a footprint of radius `r` centred at x, z): the trails, the lookout and the zipline
 * under its cable, the waterfall and the stream that feeds it, the pond, the cabins, the Den's floor, the cave's hood,
 * the slab's edge.
 */
function blocked(x: number, z: number, r: number, trailPad: number): boolean {
  if (!inChunk(x, z, 4 + r * 0.5)) return true;
  if (trailDistance(x, z) < r * 0.75 + trailPad) return true;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.r + 10 + r * 0.6) return true;
  if (z > 120 && segDist(x, z, [ZIPLINE.from.x, ZIPLINE.from.z], [ZIPLINE.to.x, ZIPLINE.to.z]) < 7 + r * 0.6) return true;
  if (segDist(x, z, [WATERFALL.lip.x, WATERFALL.lip.z], [WATERFALL.foot.x, WATERFALL.foot.z]) < 12 + r * 0.6) return true;
  if (nearestOnPolyline(RIDGE_STREAM, x, z).d < 7 + r * 0.6) return true;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 + r * 0.5) return true;
  for (const c of CABIN_SITES) if (Math.hypot(x - c.x, z - c.z) < 16 + r * 0.5) return true;
  if (cabinMask(x, z) > 0.05) return true;
  if (Math.hypot(x - DEN.x, z - DEN.z) < DEN.r - 6) return true;
  const [lx, lz] = caveLocal(x, z);
  if (lz > -9 - r && lz < 20 + r && Math.abs(lx) < 10 + r) return true;
  return false;
}

/** the crag country: the Ridge from a little below its foot, the pass, and the Den's walls */
function cragCountry(x: number, z: number): boolean {
  if (z > ridgeFootZ(x) - 12) return true;
  return Math.hypot(x - DEN.x, z - DEN.z) < DEN.r + 40 && (z > DEN.z + 4 || x > DEN.x + 4);
}

/** the terrain's slope angle (radians) at (x, z) and its downhill heading (the yaw whose front faces down the slope) */
function slopeAt(x: number, z: number): { a: number; yaw: number } {
  const [nx, ny, nz] = normalAt(x, z, 1.5);
  return { a: Math.acos(Math.min(1, Math.max(-1, ny))), yaw: Math.atan2(nx, nz) };
}

export interface PlaceOpts {
  sizes: Record<CragId, CragSize>;
  /** the forest's trunks: nothing is set on one (the kit steps round them) */
  trees?: readonly { x: number; z: number }[];
  seed?: number;
}

/**
 * The kit over the heightfield. Cliffs on every steep face of the crag country (greedy, steepest first, spaced by their
 * footprints), their fronts down the slope, their base sunk ~1 m below the ground at the front so the back is buried in
 * the slope; tors on the crest; under each cliff a talus fan: boulders and scree where the slope below it eases.
 */
export function placeCrags(o: PlaceOpts): CragPlace[] {
  const rng = new Rng(o.seed ?? 0x5ca1ab1e);
  const out: CragPlace[] = [];
  const trees = o.trees ?? [];
  const treeGrid = new Map<string, { x: number; z: number }[]>();
  for (const t of trees) { const k = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`; const l = treeGrid.get(k) ?? []; l.push(t); treeGrid.set(k, l); }
  const treeNear = (x: number, z: number, r: number): boolean => {
    for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) {
      for (const t of treeGrid.get(`${i},${j}`) ?? []) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) return true;
    }
    return false;
  };
  const size = (id: CragId): CragSize => o.sizes[id];
  const big: { x: number; z: number; r: number }[] = [];
  const clear = (x: number, z: number, r: number, k: number): boolean => big.every((b) => Math.hypot(b.x - x, b.z - z) > (b.r + r) * k);

  // ── cliffs on the steep faces ──
  const cands: { x: number; z: number; a: number; yaw: number; w: number }[] = [];
  const step = 3.2;
  for (let x = -CHUNK_HALF + 6; x < CHUNK_HALF - 6; x += step) for (let z = 110; z < CHUNK_HALF - 6; z += step) {
    const jx = x + rng.range(-1.2, 1.2), jz = z + rng.range(-1.2, 1.2);
    if (!cragCountry(jx, jz)) continue;
    const s = slopeAt(jx, jz);
    if (s.a < 0.62) continue;                                      // ≥ 35.5°: a face
    cands.push({ x: jx, z: jz, a: s.a, yaw: s.yaw, w: s.a + rng.range(0, 0.35) });
  }
  cands.sort((p, q) => q.w - p.w);
  for (const c of cands) {
    // the plateau behind the crest is rugged, not a cliff: only its steepest knuckles take a module, spaced wider
    const plateau = c.z > ridgeFootZ(c.x) + RIDGE.climb + 4 && Math.hypot(c.x - DEN.x, c.z - DEN.z) > DEN.r + 30;
    if (plateau && (c.a < 0.8 || rng.next() < 0.45)) continue;
    const id = CLIFFS[rng.int(0, CLIFFS.length - 1)] ?? 'cliff-a';
    const sz = size(id);
    const scale = plateau ? rng.range(0.8, 1.2) : rng.range(1.15, 1.7);
    const r = Math.hypot(sz.hw, sz.hd) * scale;
    const yaw = c.yaw + rng.range(-0.22, 0.22);
    // on a steep face the module leans back with the slope (a little less than it: the columns stand steeper than the
    // ground, the top buried, the foot out) and sits into the face along its normal — a vertical box on a 55° face was
    // buried to the eaves or hung its base over the drop
    const lean = plateau ? 0 : Math.min(0.8, Math.max(0, c.a - 0.32));
    const [nx, ny, nz] = normalAt(c.x, c.z, 2.5);
    const sink = (plateau ? 0.6 : 1.6) * scale;
    const x = c.x - nx * sink, z = c.z - nz * sink;
    if (!clear(x, z, r, plateau ? 0.8 : 0.75)) continue;
    if (blocked(x, z, r, 5)) continue;
    if (treeNear(x, z, r * 0.5)) continue;
    const y = heightAt(c.x, c.z) - ny * sink - (plateau ? 0.4 : 1.2) * scale;
    out.push({ id, x, y, z, yaw, scale, tiltX: -lean + rng.range(-0.04, 0.04), tiltZ: rng.range(-0.05, 0.05) });
    big.push({ x, z, r });
  }
  const cliffs = out.length;

  // ── tors on the crest and the plateau behind it ──
  for (let x = -CHUNK_HALF + 14; x < 150; x += rng.range(24, 40)) {
    const z = ridgeFootZ(x) + RIDGE.climb + rng.range(-4, 16);
    if (!inChunk(x, z, 10)) continue;
    const s = slopeAt(x, z);
    if (s.a > 0.5) continue;
    const id = TORS[rng.int(0, 1)] ?? 'tor-a';
    const sz = size(id), scale = rng.range(0.9, 1.4), r = Math.hypot(sz.hw, sz.hd) * scale;
    if (!clear(x, z, r, 0.8) || blocked(x, z, r, 6) || treeNear(x, z, r * 0.6)) continue;
    out.push({ id, x, y: heightAt(x, z) - 0.6 * scale, z, yaw: rng.range(0, Math.PI * 2), scale, tiltX: rng.range(-0.05, 0.05), tiltZ: rng.range(-0.05, 0.05) });
    big.push({ x, z, r });
  }

  // ── talus: below each cliff, where the slope eases ──
  const small: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < cliffs; i++) {
    const c = out[i];
    if (!c) continue;
    const sz = size(c.id);
    const n = rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      const yaw = c.yaw + rng.range(-0.6, 0.6);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      // walk down the fall line from the cliff's front until the ground eases below ~34°
      let d = sz.hd * c.scale + rng.range(0.5, 2.5), x = c.x + fx * d, z = c.z + fz * d;
      for (let g = 0; g < 14 && slopeAt(x, z).a > 0.6; g++) { d += 1.6; x = c.x + fx * d; z = c.z + fz * d; }
      d += rng.range(0, 5); x = c.x + fx * d; z = c.z + fz * d;
      const scree = rng.next() < 0.45;
      const id = scree ? (SCREES[rng.int(0, 1)] ?? 'scree-a') : (BOULDERS[rng.int(0, 2)] ?? 'boulder-a');
      const bs = size(id), scale = scree ? rng.range(0.8, 1.25) : rng.range(0.7, 1.3), r = Math.hypot(bs.hw, bs.hd) * scale;
      if (slopeAt(x, z).a > 0.72) continue;
      if (blocked(x, z, r, scree ? 1.5 : 2.5) || treeNear(x, z, scree ? 0.9 : r * 0.7)) continue;
      if (!small.every((b) => Math.hypot(b.x - x, b.z - z) > (b.r + r) * 0.7) || !clear(x, z, r, 0.45)) continue;
      const s = slopeAt(x, z);
      // scree lies with the ground (its fan down the fall line); a boulder settles with a little of the slope
      const lie = scree ? 1 : 0.35, tilt = s.a * lie;
      out.push({ id, x, y: heightAt(x, z) - (scree ? 0.05 : 0.25 * scale), z, yaw: scree ? s.yaw : rng.range(0, Math.PI * 2), scale, tiltX: tilt, tiltZ: 0 });
      small.push({ x, z, r });
      if (scree) out[out.length - 1] = { ...(out[out.length - 1] as CragPlace), yaw: s.yaw };
    }
  }
  return out;
}

/** a placement's matrix: yaw about +Y, then the tilt (a scree patch lies with the slope: tiltX pitches its front down) */
export function cragMatrix(p: CragPlace, out = new THREE.Matrix4()): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tiltX, p.yaw, p.tiltZ, 'YXZ'));
  return out.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
}

// ───────────────────────────────────── the face skin (the heightfield's steep faces as granite) ─────────────────────────

const fract = (v: number): number => v - Math.floor(v);
const hash1 = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
function vnoise2(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number): number => hash1(a * 57 + b * 113);
  return (h(ix, iz) * (1 - ux) + h(ix + 1, iz) * ux) * (1 - uz) + (h(ix, iz + 1) * (1 - ux) + h(ix + 1, iz + 1) * ux) * uz;
}

/** how much of the face skin covers (x, z): 0 on gentle ground, 1 on the crag country's steep faces (from ~38° to ~46°) */
export function skinWeight(x: number, z: number): number {
  if (!cragCountry(x, z) || !inChunk(x, z, 3)) return 0;
  const s = slopeAt(x, z);
  let w = ss(0.64, 0.8, s.a);
  if (w <= 0) return 0;
  // not over the trails (the lookout's graded traverse, the N road's pass), the lookout's pad, the waterfall's lip, the cave's hood
  w *= ss(3, 7, trailDistance(x, z));
  w *= ss(LOOKOUT.r + 3, LOOKOUT.r + 8, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z));
  w *= ss(5, 10, segDist(x, z, [WATERFALL.lip.x, WATERFALL.lip.z], [WATERFALL.foot.x, WATERFALL.foot.z]));
  const [lx, lz] = caveLocal(x, z);
  if (lz > -8 && lz < 18 && Math.abs(lx) < 9) w *= ss(9, 6, Math.abs(lx)) < 1 ? 1 - ss(9, 6, Math.abs(lx)) * ss(-8, -4, lz) * ss(18, 14, lz) : 0;
  return w;
}

/**
 * One tile of the face skin: the heightfield's steep faces re-drawn in granite at `step` m, pushed out along the slope's
 * horizontal normal into stepped bands — each band a near-vertical riser over a flat tread (the ledges: the moss and the
 * grit settle there), the bands' heights and offsets varying column by column (the vertical joints), a slow noise over
 * it all — and diving back under the ground where the slope eases, so the skin comes out of the terrain without an edge.
 * Null when the tile has no face.
 */
export function skinTile(x0: number, z0: number, size: number, step: number): THREE.BufferGeometry | null {
  const n = Math.round(size / step) + 1;
  const w = new Float32Array(n * n);
  let any = false;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = skinWeight(x0 + i * step, z0 + j * step); w[j * n + i] = v; if (v > 0) any = true; }
  if (!any) return null;
  const pos = new Float32Array(n * n * 3), cd = new Float32Array(n * n * 4), keep = new Int32Array(n * n).fill(-1);
  const idx: number[] = [];
  const used = new Uint8Array(n * n);
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = j * n + i;
    if ((w[a] ?? 0) + (w[a + 1] ?? 0) + (w[a + n] ?? 0) + (w[a + n + 1] ?? 0) <= 0) continue;
    used[a] = used[a + 1] = used[a + n] = used[a + n + 1] = 1;
  }
  let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i;
    if (!used[a]) continue;
    const x = x0 + i * step, z = z0 + j * step, h = heightAt(x, z), ww = w[a] ?? 0;
    const [nx, ny, nz] = normalAt(x, z, 2.5);
    const hl = Math.hypot(nx, nz) || 1, ox = nx / hl, oz = nz / hl;
    const tan = Math.max(0.9, hl / Math.max(0.15, ny));
    // the column (a joint every ~3–5 m along the contour) sets its bands' height and phase
    const along = x * -oz + z * ox;
    const col = Math.floor(along / 5.5 + vnoise2(x * 0.06, z * 0.06) * 1.4);
    const H = 4.0 + hash1(col) * 4.0;
    const t = fract((h + hash1(col + 7.3) * H) / H + (vnoise2(x * 0.2, z * 0.2) - 0.5) * 0.1);
    // the riser: the band's points pulled onto one vertical plane (t = 0 its foot, 1 its top); a crisp lip where it wraps
    const riser = (0.5 - t) * (H / tan);
    const rough = (vnoise2(x * 0.22, z * 0.22 + h * 0.1) - 0.5) * 0.45 + (vnoise2(x * 0.9 + h * 0.5, z * 0.9) - 0.5) * 0.12;
    const out = ww * (1.45 + riser + rough + hash1(col + 3.1) * 0.6) - (1 - ww) * 0.5;
    pos[k * 3] = x + ox * out; pos[k * 3 + 1] = h - (1 - ww) * 0.15; pos[k * 3 + 2] = z + oz * out;
    // AO: the foot of each riser (under the tread above) darker, the treads open
    cd.set([0.5 + 0.45 * Math.min(1, t * 1.6), 1, 0, 1], k * 4);
    keep[a] = k++;
  }
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = keep[j * n + i] ?? -1, b = keep[(j + 1) * n + i] ?? -1, c = keep[(j + 1) * n + i + 1] ?? -1, d = keep[j * n + i + 1] ?? -1;
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    const wa = (w[j * n + i] ?? 0) + (w[(j + 1) * n + i] ?? 0) + (w[(j + 1) * n + i + 1] ?? 0) + (w[j * n + i + 1] ?? 0);
    if (wa <= 0) continue;
    idx.push(a, b, d, b, c, d);
  }
  if (idx.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, k * 3), 3));
  g.setAttribute('cdata', new THREE.BufferAttribute(cd.slice(0, k * 4), 4));
  g.setAttribute('ctint', new THREE.BufferAttribute(new Float32Array(k * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** the skin's tiles (m) and its two resolutions (m): phone / desktop */
const SKIN_TILE = 64, SKIN_STEP = TIER === 'phone' ? [1.0, 2.6] : [0.7, 2.0];

// ───────────────────────────────────────────────── the cave's data ─────────────────────────────────────────────────

/** cave.json (build_cave.py): everything in the cave's frame (lx across, lz in, y world height) */
export interface CaveMeta {
  version: number;
  /** the render hole: drawn-terrain triangles whose box overlaps one of these (local, axis-aligned) are dropped */
  holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number }[];
  /** the physics heightfield is pushed below `below` inside these (local rects; grown a cell by cutTerrain) */
  cuts: { lx: number; lz: number; hw: number; hd: number; below: number }[];
  /** the cave reverb / bed: circles along the passage and the room */
  spots: { lx: number; lz: number; r: number }[];
  /** the footprint (rain never falls inside it) */
  inside: [number, number][];
  /** the crack's shaft of light: its top (at the crack) and its foot (on the floor), radii */
  shaft: { top: [number, number, number]; foot: [number, number, number]; r0: number; r1: number };
  /** drip points on the roof: lx, y, lz, and the floor's height under each */
  drips: [number, number, number, number][];
  /** the floor's height along the passage (lz → y), for the spawn / the test poses */
  floor: [number, number][];
}

// ──────────────────────────────────────────────────── the material ─────────────────────────────────────────────────

/** the granite's tile (m): one mossy_rock repeat per 4.6 m on the faces, the grit per 3.4 m */
const ROCK_TILE = 4.6, GRIT_TILE = 3.4;
/** the cave's fill (see the material): PineCrags.update drives it from the clock */
const CAVE_FILL = { value: 1.0 };

/**
 * Triplanar granite in world space for the BatchedMesh (and the cave inside it): albedo / normal / ARM from `mossy_rock`
 * on the X and Z projections and on the Y one blended with `rock_ground` grit on the ledges, moss on the up-facing,
 * dark rain streaks down the faces, and a tint path for the cave's bedding and bones. The vertex `cdata` = (AO, sun reach,
 * wet, rock): AO multiplies the indirect light, sun reach the directional lights only.
 */
function cragMaterial(sky: Sky, rock: PBRSet, grit: PBRSet): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const u = {
    tRockD: { value: rock.map }, tRockN: { value: rock.normalMap }, tRockA: { value: rock.armMap },
    tGritD: { value: grit.map }, tGritN: { value: grit.normalMap },
    /** the cave's fill: the light the mouth and the crack let in, scattered off every wall (no direction) — day-driven */
    uCaveFill: CAVE_FILL,
    /** `?cragdebug=ao|sun|wet|normal|albedo`: that channel instead of the shade (dev) */
    uCragDebug: { value: ['', 'ao', 'sun', 'wet', 'normal', 'albedo'].indexOf(typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('cragdebug') ?? '') },
  };
  for (const t of [rock.map, rock.normalMap, rock.armMap, grit.map, grit.normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; }
  mat.customProgramCacheKey = () => 'pine-crag';
  sky.setupMaterial(mat);
  const csmHook = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    csmHook(shader, renderer); // CSM's uniforms (its lights_fragment_begin is the global chunk, patched below)
    attachFogUniforms(shader);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 cdata;
        attribute vec2 ctint;
        varying vec3 vCW;
        varying vec3 vCN;
        varying vec4 vCD;
        varying vec2 vCT;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 cw = vec4( transformed, 1.0 );
          vec3 cn = objectNormal;
          #ifdef USE_BATCHING
            cw = batchingMatrix * cw; cn = mat3( batchingMatrix ) * cn;
          #endif
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw; cn = mat3( instanceMatrix ) * cn;
          #endif
          vCW = ( modelMatrix * cw ).xyz;
          vCN = normalize( mat3( modelMatrix ) * cn );
          vCD = cdata; vCT = ctint;
        }`);
    // the directional lights (the sun / the moon through CSM) × sun reach; point lights (the lantern, the lamps) untouched
    const lightsBegin = THREE.ShaderChunk.lights_fragment_begin.replaceAll(/getDirectionalLightInfo\(([^;]+)\);/g, 'getDirectionalLightInfo($1); directLight.color *= vCD.g;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tRockD, tRockN, tRockA, tGritD, tGritN;
        uniform int uCragDebug;
        uniform float uCaveFill;
        varying vec3 vCW;
        varying vec3 vCN;
        varying vec4 vCD;
        varying vec2 vCT;
        float cHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
        float cNoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( cHash( i ), cHash( i + vec2( 1, 0 ) ), f.x ), mix( cHash( i + vec2( 0, 1 ) ), cHash( i + vec2( 1, 1 ) ), f.x ), f.y );
        }
        // whiteout-blended tangent normal → world, for a projection whose tangent plane is (a, b) and axis c
        vec3 cUnpack( vec4 t ) { return t.xyz * 2.0 - 1.0; }
        `)
      .replace('#include <map_fragment>', `
        vec3 cwn = normalize( vCN );
        vec3 cb = pow( abs( cwn ), vec3( 4.0 ) ); cb /= max( cb.x + cb.y + cb.z, 1e-5 );
        vec3 sg = sign( cwn + 1e-4 );
        vec2 uvX = vec2( vCW.z * sg.x, vCW.y ) * ${(1 / ROCK_TILE).toFixed(4)};
        vec2 uvY = vec2( vCW.x * sg.y, vCW.z ) * ${(1 / ROCK_TILE).toFixed(4)};
        vec2 uvZ = vec2( -vCW.x * sg.z, vCW.y ) * ${(1 / ROCK_TILE).toFixed(4)};
        float up = smoothstep( 0.45, 0.9, cwn.y );
        float outside = vCD.g;
        float rockW = step( 0.5, vCD.a );
        // the grit on the ledges (the Y projection): patchy
        float gritN = cNoise( vCW.xz * 0.35 ) * 0.65 + cNoise( vCW.xz * 1.3 ) * 0.35;
        float grit = up * smoothstep( 0.35, 0.65, gritN ) * rockW;
        vec3 aX = texture2D( tRockD, uvX ).rgb, aZ = texture2D( tRockD, uvZ ).rgb;
        vec3 aY = texture2D( tRockD, uvY ).rgb;
        vec2 uvG = vCW.xz * ${(1 / GRIT_TILE).toFixed(4)};
        if ( grit > 0.01 ) aY = mix( aY, texture2D( tGritD, uvG ).rgb * vec3( 0.95, 0.93, 0.9 ), grit );
        vec3 alb = aX * cb.x + aY * cb.y + aZ * cb.z;
        vec3 armX = texture2D( tRockA, uvX ).rgb, armY = texture2D( tRockA, uvY ).rgb, armZ = texture2D( tRockA, uvZ ).rgb;
        vec3 carm = armX * cb.x + armY * cb.y + armZ * cb.z;
        // granite, not a lichen carpet: the lichen's green / yellow cools toward grey on the steep faces and in the dark
        float lum = dot( alb, vec3( 0.299, 0.587, 0.114 ) );
        float keep = mix( 0.58, 0.9, up ) * mix( 0.5, 1.0, outside );
        alb = mix( vec3( lum ) * vec3( 0.98, 1.0, 1.04 ), alb, keep );
        // rain streaks down the faces: dark vertical stains under the ledges
        float streak = cNoise( vec2( ( vCW.x + vCW.z ) * 0.9, vCW.y * 0.06 ) ) * cNoise( vec2( ( vCW.x - vCW.z ) * 0.33, vCW.y * 0.02 + 7.0 ) );
        alb *= 1.0 - 0.38 * smoothstep( 0.12, 0.45, streak ) * ( 1.0 - up ) * outside;
        // moss on the up-facing, outside (the cave's floor stays bare)
        float mossN = cNoise( vCW.xz * 0.21 + 3.0 ) * 0.6 + cNoise( vCW.xz * 0.9 ) * 0.4;
        float moss = smoothstep( 0.62, 0.92, cwn.y ) * smoothstep( 0.42, 0.62, mossN ) * outside * rockW * ( 1.0 - grit * 0.6 );
        alb = mix( alb, vec3( 0.075, 0.095, 0.035 ) * ( 0.8 + 0.4 * mossN ), moss * 0.85 );
        // a macro variation so a face does not tile
        alb *= 0.86 + 0.28 * cNoise( vCW.xz * 0.045 + vCW.y * 0.03 );
        alb *= mix( vec3( 1.0 ), vec3( 1.1, 1.0, 0.86 ), smoothstep( 0.35, 0.75, cNoise( vCW.xz * 0.018 + 9.0 ) ) * rockW ); // warm iron-stained patches
        // the tint path (the cave's bedding, bones, twigs): its own albedo, the granite's normal for grain
        vec3 tintCol = vCT.y < 0.25 ? vec3( 0.62, 0.58, 0.49 ) : vCT.y < 0.5 ? vec3( 0.42, 0.33, 0.19 ) : vec3( 0.19, 0.13, 0.08 );
        alb = mix( tintCol * vCT.x * ( 0.85 + 0.3 * cNoise( vCW.xz * 6.0 ) ), alb, rockW );
        diffuseColor.rgb *= alb;
        float cRough = mix( 0.95, carm.g, rockW );
        cRough = mix( cRough, 0.9, moss );
        float cAO = mix( 1.0, carm.r, 0.75 * rockW );
        // the cave's wet (drips, the damp floor): darker, glossier
        diffuseColor.rgb *= 1.0 - 0.35 * vCD.b;
        cRough = mix( cRough, 0.28, vCD.b );`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * cRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = 0.0;')
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 nX = cUnpack( texture2D( tRockN, uvX ) ), nY = cUnpack( texture2D( tRockN, uvY ) ), nZ = cUnpack( texture2D( tRockN, uvZ ) );
          if ( grit > 0.01 ) nY = normalize( mix( nY, cUnpack( texture2D( tGritN, uvG ) ), grit ) );
          nX.x *= sg.x; nY.x *= sg.y; nZ.x *= -sg.z;
          float str = mix( 0.35, 1.0, rockW ) * ( 1.0 - 0.6 * moss );
          nX.xy *= str; nY.xy *= str; nZ.xy *= str;
          // whiteout blend (the tangent frames: X ← (z, y), Y ← (x, z), Z ← (x, y))
          vec3 tX = vec3( nX.xy + cwn.zy, abs( nX.z ) * cwn.x );
          vec3 tY = vec3( nY.xy + cwn.xz, abs( nY.z ) * cwn.y );
          vec3 tZ = vec3( nZ.xy + vec2( -cwn.x, cwn.y ), abs( nZ.z ) * cwn.z );
          vec3 wN = normalize( tX.zyx * cb.x + tY.xzy * cb.y + vec3( -tZ.x, tZ.y, tZ.z ) * cb.z );
          normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uCaveFill * vCD.r * ( 1.0 - vCD.g );`)
      .replace('#include <lights_fragment_begin>', lightsBegin)
      // the haze belongs outside: in the cave (sun reach 0) the fog's bright sky colour is kept off the rock
      .replace('#include <fog_fragment>', `vec3 cPreFog = gl_FragColor.rgb;
        #include <fog_fragment>
        gl_FragColor.rgb = mix( cPreFog, gl_FragColor.rgb, mix( 0.06, 1.0, vCD.g ) );`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if ( uCragDebug == 1 ) gl_FragColor = vec4( vec3( vCD.r ), 1.0 );
        else if ( uCragDebug == 2 ) gl_FragColor = vec4( vec3( vCD.g ), 1.0 );
        else if ( uCragDebug == 3 ) gl_FragColor = vec4( vec3( vCD.b ), 1.0 );
        else if ( uCragDebug == 4 ) gl_FragColor = vec4( normalize( vCN ) * 0.5 + 0.5, 1.0 );
        else if ( uCragDebug == 5 ) gl_FragColor = vec4( diffuseColor.rgb, 1.0 );`)
      .replace('#include <aomap_fragment>', `
        {
          // inside, the fill (the emissive term) is the cave's light
          // (the sky's own light has no business under the roof: there the fill carries it, the same from every side)
          float amb = cAO * max( vCD.r, 0.012 ) * mix( 0.3, 1.0, vCD.g );
          reflectedLight.indirectDiffuse *= amb;
          reflectedLight.indirectSpecular *= amb * mix( 0.35, 1.0, vCD.g );
        }`);
  };
  return mat;
}

// ─────────────────────────────────────────────────────── the set ───────────────────────────────────────────────────

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** position / normal back to float (meshopt quantizes), the colour → `cdata` (vec4), the tint UV → `ctint`; nothing else */
function kitGeometry(src: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const f32 = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < a.itemSize ? a.getComponent(i, k) : 1;
    return out;
  };
  const n = src.getAttribute('position').count;
  g.setAttribute('position', new THREE.BufferAttribute(f32('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(f32('normal', 3), 3));
  g.setAttribute('cdata', src.hasAttribute('color') ? new THREE.BufferAttribute(f32('color', 4), 4) : new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4));
  g.setAttribute('ctint', src.hasAttribute('uv') ? new THREE.BufferAttribute(f32('uv', 2), 2) : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const idx = src.getIndex();
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)), 1));
  g.applyMatrix4(matrix);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

async function loadNodes(url: string): Promise<Map<string, THREE.BufferGeometry>> {
  const out = new Map<string, THREE.BufferGeometry>();
  const g = await gltf.loadAsync(url);
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!('isMesh' in o)) return;
    const mesh = o as THREE.Mesh;
    out.set(mesh.name, kitGeometry(mesh.geometry, mesh.matrixWorld));
  });
  return out;
}

/** LOD / range per kind (m, camera to the instance): the cliffs' full model near, their LOD1 to the slab's edge */
const LOD = TIER === 'phone'
  ? { big: 95, bigFar: 900, small: 38, smallFar: 170, scree: 30, screeFar: 110, cave: 70 }
  : { big: 170, bigFar: 900, small: 70, smallFar: 320, scree: 55, screeFar: 200, cave: 110 };

interface Inst { id: number; x: number; y: number; z: number; r: number; near: number; far: number; lod0: number; lod1: number; state: number }

export interface CaveHandle { meta: CaveMeta; inst: Inst | null; hood: Inst | null }

export class PineCrags {
  readonly group = new THREE.Group();
  /** the modules' hulls and the cave's trimesh (registered in a few pieces: the phone's per-task collider budget) */
  readonly colliders: ColliderDesc[] = [];
  readonly caveColliders: ColliderDesc[] = [];
  places: CragPlace[] = [];
  private batch: THREE.BatchedMesh | null = null;
  private insts: Inst[] = [];
  private cave: CaveHandle | null = null;
  private last = new THREE.Vector3(1e9, 0, 0);
  private tmp = new THREE.Vector3();
  private shaft: THREE.Mesh | null = null;
  private drips: THREE.Points | null = null;
  private dripState: Float32Array = new Float32Array(0);
  private caveNear = false;
  private skin: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];

  private constructor(private sky: Sky | null, private kit: Map<string, THREE.BufferGeometry>, private caveGeo: Map<string, THREE.BufferGeometry>, private caveMeta: CaveMeta | null, private mat: THREE.Material | null) {
    this.group.name = 'pine-crags';
  }

  /** the kit, the cave and their textures; null when the kit is not in this build. `sky` null: geometry only (the bake) */
  static async load(sky: Sky | null): Promise<PineCrags | null> {
    try {
      const [kit, caveGeo, caveMeta, tex] = await Promise.all([
        loadNodes(`${CRAG_DIR}/crags.glb`),
        loadNodes(`${CRAG_DIR}/cave.glb`).catch((e: unknown) => { console.warn('[crags] no cave.glb', e); return new Map<string, THREE.BufferGeometry>(); }),
        fetch(`${CRAG_DIR}/cave.json`).then(async (r) => (r.ok ? (await r.json()) as CaveMeta : null)).catch(() => null),
        sky ? Promise.all([loadPBR('mossy_rock'), loadPBR('rock_ground')]) : Promise.resolve(null),
      ]);
      const mat = sky && tex ? cragMaterial(sky, tex[0], tex[1]) : null;
      return new PineCrags(sky, kit, caveGeo, caveMeta, mat);
    } catch (e: unknown) {
      console.warn('[crags] the kit did not load', e);
      return null;
    }
  }

  /** every module's footprint (its LOD0's box, in its own frame) */
  sizes(): Record<CragId, CragSize> {
    const out = {} as Record<CragId, CragSize>;
    for (const id of CRAG_IDS) {
      const b = this.kit.get(id)?.boundingBox ?? new THREE.Box3(new THREE.Vector3(-4, 0, -3), new THREE.Vector3(4, 8, 3));
      out[id] = { hw: Math.max(-b.min.x, b.max.x), hd: Math.max(-b.min.z, b.max.z), h: b.max.y };
    }
    return out;
  }

  /** draw (when a material exists) and collide the placements and the cave */
  /** the face skin's tiles (both resolutions), a tile per task (~130 ms of phone CPU in all); only drawn builds need it */
  async prepareSkin(yieldTask: () => Promise<void>): Promise<void> {
    if (!this.mat) return;
    for (let tz = 96; tz < CHUNK_HALF; tz += SKIN_TILE) for (let tx = -CHUNK_HALF; tx < CHUNK_HALF; tx += SKIN_TILE) {
      const g0 = skinTile(tx, tz, SKIN_TILE, SKIN_STEP[0] ?? 1), g1 = skinTile(tx, tz, SKIN_TILE, SKIN_STEP[1] ?? 2.6);
      if (g0 && g1) this.skin.push([g0, g1]);
      await yieldTask();
    }
  }

  build(places: CragPlace[]): this {
    this.places = places;
    const geoIds = new Map<string, number>();
    const geos: THREE.BufferGeometry[] = [];
    const want = (name: string): number => {
      let id = geoIds.get(name);
      if (id !== undefined) return id;
      const g = this.kit.get(name) ?? this.caveGeo.get(name);
      if (!g) return -1;
      id = geos.length; geos.push(g); geoIds.set(name, id);
      return id;
    };
    const plan: { p: THREE.Matrix4; lod0: number; lod1: number; near: number; far: number; r: number; x: number; y: number; z: number }[] = [];
    const m = new THREE.Matrix4();
    for (const p of places) {
      const lod0 = want(p.id), lod1 = want(`${p.id}-lod1`);
      if (lod0 < 0) continue;
      const kind = p.id.startsWith('scree') ? 'scree' : p.id.startsWith('boulder') ? 'small' : 'big';
      const near = kind === 'big' ? LOD.big : kind === 'small' ? LOD.small : LOD.scree;
      const far = kind === 'big' ? LOD.bigFar : kind === 'small' ? LOD.smallFar : LOD.screeFar;
      const g = geos[lod0];
      const bs = g?.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 5);
      cragMatrix(p, m);
      const c = bs.center.clone().applyMatrix4(m);
      plan.push({ p: m.clone(), lod0, lod1: lod1 < 0 ? lod0 : lod1, near, far, r: bs.radius * p.scale, x: c.x, y: c.y, z: c.z });
      // collision: a hull per cliff / tor / boulder from its LOD1 (the scree is ankle-high: walked over)
      if (kind !== 'scree') {
        const lg = geos[lod1 < 0 ? lod0 : lod1];
        if (lg) this.colliders.push(hullOf(lg, m, p, kind === 'big' ? 110 : 60));
      }
    }
    // the face skin: one geometry per tile per resolution, identity matrix (its vertices are world positions)
    if (this.mat) {
      for (const [g0, g1] of this.skin) {
        const i0 = geos.length; geos.push(g0); const i1 = geos.length; geos.push(g1);
        const bs = g0.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), SKIN_TILE);
        plan.push({ p: new THREE.Matrix4(), lod0: i0, lod1: i1, near: LOD.big * 0.8, far: LOD.bigFar, r: bs.radius, x: bs.center.x, y: bs.center.y, z: bs.center.z });
      }
    }
    // the cave: its interior + hood near, the hood alone (simplified) far; its walls and floor as a trimesh
    const caveM = new THREE.Matrix4().makeRotationY(CAVE_FRAME.yaw).setPosition(CAVE_FRAME.x, 0, CAVE_FRAME.z);
    const cave0 = want('cave'), hoodFar = want('cave-far');
    let caveIdx = -1, hoodIdx = -1;
    if (cave0 >= 0) {
      const g = geos[cave0];
      const bs = g?.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 30);
      const c = bs.center.clone().applyMatrix4(caveM);
      caveIdx = plan.length;
      plan.push({ p: caveM.clone(), lod0: cave0, lod1: cave0, near: 1e9, far: LOD.cave, r: bs.radius, x: c.x, y: c.y, z: c.z });
      if (hoodFar >= 0) {
        hoodIdx = plan.length;
        plan.push({ p: caveM.clone(), lod0: hoodFar, lod1: hoodFar, near: 1e9, far: 1200, r: bs.radius, x: c.x, y: c.y, z: c.z });
      }
      const col = this.caveGeo.get('cave-col') ?? g;
      if (col) this.caveColliders.push(trimeshOf(col, caveM));
    }
    if (this.caveMeta) this.caveColliders.push(...this.roofPatch());

    if (this.mat && plan.length > 0 && geos.length > 0) {
      let v = 0, ix = 0;
      for (const g of geos) { v += g.getAttribute('position').count; ix += g.index ? g.index.count : g.getAttribute('position').count; }
      const bm = this.batch = new THREE.BatchedMesh(plan.length, v, ix, this.mat);
      bm.name = 'pine-crags';
      bm.sortObjects = false; bm.perObjectFrustumCulled = true;
      bm.castShadow = true; bm.receiveShadow = true;
      const ids = geos.map((g) => bm.addGeometry(g));
      for (const q of plan) {
        const g0 = ids[q.lod0], g1 = ids[q.lod1];
        if (g0 === undefined || g1 === undefined) continue;
        const id = bm.addInstance(g0);
        bm.setMatrixAt(id, q.p);
        this.insts.push({ id, x: q.x, y: q.y, z: q.z, r: q.r, near: q.near, far: q.far, lod0: g0, lod1: g1, state: 0 });
      }
      this.group.add(bm);
    }
    if (this.caveMeta) {
      const find = (i: number): Inst | null => (i >= 0 ? this.insts[i] ?? null : null);
      this.cave = { meta: this.caveMeta, inst: find(caveIdx), hood: find(hoodIdx) };
      if (this.sky) this.buildCaveFx(this.caveMeta);
    }
    return this;
  }

  // ── the cave's frame helpers ──

  /** the cave's data (null: no cave.json in this build) */
  get caveMetaData(): CaveMeta | null { return this.caveMeta; }

  /** the physics heightfield's cuts (world rects): the ground under the passage where the slope runs through it */
  terrainCuts(): TerrainCut[] {
    return (this.caveMeta?.cuts ?? []).map((c) => { const [x, z] = caveWorld(c.lx, c.lz); return { x, z, hw: c.hw, hd: c.hd, yaw: CAVE_FRAME.yaw, below: c.below }; });
  }

  /** the drawn terrain's hole: true for a triangle (world vertices) that reaches into the cave's passage */
  holeTest(): (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean {
    const holes = this.caveMeta?.holes ?? [];
    return (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const [alx, alz] = caveLocal(ax, az), [blx, blz] = caveLocal(bx, bz), [clx, clz] = caveLocal(cx, cz);
      const x0 = Math.min(alx, blx, clx), x1 = Math.max(alx, blx, clx), z0 = Math.min(alz, blz, clz), z1 = Math.max(alz, blz, clz);
      const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
      for (const h of holes) {
        if (x1 < h.lx - h.hw || x0 > h.lx + h.hw || z1 < h.lz - h.hd || z0 > h.lz + h.hd || y1 < h.y0 || y0 > h.y1) continue;
        return true;
      }
      return false;
    };
  }

  /** the cave's reverb / bed spots, world (the mouth's own spot is the audio lane's — these go inside) */
  caveSpots(): { x: number; z: number; r: number }[] {
    return (this.caveMeta?.spots ?? []).map((s) => { const [x, z] = caveWorld(s.lx, s.lz); return { x, z, r: s.r }; });
  }

  /** inside the cave's footprint (no rain falls there) */
  inCave(x: number, z: number): boolean {
    const poly = this.caveMeta?.inside;
    if (!poly || poly.length < 3) return false;
    const [lx, lz] = caveLocal(x, z);
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (!a || !b) continue;
      if ((a[1] > lz) !== (b[1] > lz) && lx < ((b[0] - a[0]) * (lz - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /** the passage's floor height at depth `lz` (the test poses, the spawn) */
  caveFloorAt(lz: number): number | undefined {
    const f = this.caveMeta?.floor;
    if (!f || f.length === 0) return undefined;
    for (let i = 0; i + 1 < f.length; i++) {
      const a = f[i], b = f[i + 1];
      if (a && b && lz >= a[0] && lz <= b[0]) return a[1] + (b[1] - a[1]) * ((lz - a[0]) / Math.max(1e-6, b[0] - a[0]));
    }
    return undefined;
  }

  /**
   * The terrain over the cut (its drawn triangles that are not in the hole) as a trimesh: the heightfield under the cut
   * was pushed below the cave's floor, so the ground up there — on the slope above the mouth — comes back as this.
   */
  private roofPatch(): ColliderDesc[] {
    const cuts = this.terrainCuts();
    if (cuts.length === 0) return [];
    const res = TERRAIN_RES, d = CHUNK_SIZE / (res - 1), half = CHUNK_SIZE / 2;
    const hole = this.holeTest();
    const cells = new Set<number>();
    for (const c of cuts) {
      const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw), r = Math.hypot(c.hw, c.hd) + 3 * d;
      const i0 = Math.max(0, Math.floor((c.x - r + half) / d)), i1 = Math.min(res - 2, Math.ceil((c.x + r + half) / d));
      const k0 = Math.max(0, Math.floor((c.z - r + half) / d)), k1 = Math.min(res - 2, Math.ceil((c.z + r + half) / d));
      for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const dx = ix * d - half - c.x, dz = iz * d - half - c.z;
        const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
        if (Math.abs(lx) > c.hw + 2.5 * d || Math.abs(lz) > c.hd + 2.5 * d) continue;
        cells.add(iz * res + ix);
      }
    }
    const verts: number[] = [], idx: number[] = [];
    const ox = CAVE_FRAME.x, oz = CAVE_FRAME.z;
    const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): void => {
      const ay = heightAt(ax, az), by = heightAt(bx, bz), cy = heightAt(cx, cz);
      if (hole(ax, ay, az, bx, by, bz, cx, cy, cz)) return;
      const b = verts.length / 3;
      verts.push(ax - ox, ay, az - oz, bx - ox, by, bz - oz, cx - ox, cy, cz - oz);
      idx.push(b, b + 1, b + 2);
    };
    for (const cell of cells) {
      const ix = cell % res, iz = Math.floor(cell / res);
      const x0 = ix * d - half, x1 = x0 + d, z0 = iz * d - half, z1 = z0 + d;
      tri(x0, z0, x0, z1, x1, z0); tri(x0, z1, x1, z1, x1, z0);
    }
    if (idx.length === 0) return [];
    return [{ kind: 'trimesh', x: ox, y: 0, z: oz, vertices: Float32Array.from(verts), indices: Uint32Array.from(idx), surface: 'rock' }];
  }

  // ── the cave's shaft of light and drips ──

  private buildCaveFx(meta: CaveMeta): void {
    const toW = (p: [number, number, number]): THREE.Vector3 => { const [x, z] = caveWorld(p[0], p[2]); return new THREE.Vector3(x, p[1], z); };
    // the shaft: an open cone from the crack to the floor, additive, brightest at the crack, fading to the floor and toward its rim
    const top = toW(meta.shaft.top), foot = toW(meta.shaft.foot);
    const len = top.distanceTo(foot);
    const geo = new THREE.CylinderGeometry(meta.shaft.r0, meta.shaft.r1, len, 20, 6, true);
    geo.translate(0, -len / 2, 0);
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uLen: { value: len } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        uniform float uLen;
        void main() {
          vT = -position.y / uLen;
          vec4 w = modelMatrix * vec4( position, 1.0 );
          vP = w.xyz;
          vN = normalize( mat3( modelMatrix ) * normal );
          vV = normalize( cameraPosition - w.xyz );
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        uniform float uI; uniform float uTime;
        void main() {
          float rim = abs( dot( normalize( vN ), vV ) );
          float body = pow( rim, 2.2 );
          float along = ( 1.0 - vT * 0.75 ) * smoothstep( 0.0, 0.06, vT ) * smoothstep( 1.0, 0.82, vT );
          float mote = 0.85 + 0.15 * sin( vP.y * 3.1 + uTime * 0.7 + vP.x * 5.0 ) * sin( vP.z * 4.3 - uTime * 0.4 );
          float near = smoothstep( 0.8, 4.0, length( vP - cameraPosition ) ); // walked into, it thins out instead of whiting the view
          gl_FragColor = vec4( vec3( 1.0, 0.93, 0.78 ) * body * along * mote * near * uI, 1.0 );
        }`,
    });
    const shaft = new THREE.Mesh(geo, shaftMat);
    shaft.position.copy(top);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foot.clone().sub(top).normalize());
    shaft.renderOrder = 7; shaft.frustumCulled = true; shaft.visible = false;
    shaft.name = 'cave-shaft';
    this.shaft = shaft;
    this.group.add(shaft);
    // the drips: a Points per drip point, each falling from the roof on its own clock
    const n = meta.drips.length;
    if (n > 0) {
      const pos = new Float32Array(n * 3);
      this.dripState = new Float32Array(n * 4);
      meta.drips.forEach((d, i) => {
        const [x, z] = caveWorld(d[0], d[2]);
        this.dripState.set([x, d[1], z, d[3]], i * 4);
        pos.set([x, d[1], z], i * 3);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: 0xcfd8dc, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      const pts = new THREE.Points(g, pm);
      pts.name = 'cave-drips'; pts.visible = false; pts.frustumCulled = false;
      this.drips = pts;
      this.group.add(pts);
    }
  }

  /** per frame: the LODs and ranges (when the camera has moved a metre), the cave's shaft and drips near it */
  update(t: number): void {
    const sky = this.sky;
    if (!sky) return;
    const cam = sky.viewCamera; cam.getWorldPosition(this.tmp);
    const p = this.tmp;
    const bm = this.batch;
    if (bm && p.distanceToSquared(this.last) > 1) {
      this.last.copy(p);
      for (const it of this.insts) {
        const dd = Math.hypot(it.x - p.x, it.y - p.y, it.z - p.z) - it.r * 0.5;
        const state = dd > it.far ? 2 : dd > it.near ? 1 : 0;
        if (state === it.state) continue;
        it.state = state;
        bm.setVisibleAt(it.id, state !== 2);
        if (state !== 2) bm.setGeometryIdAt(it.id, state === 0 ? it.lod0 : it.lod1);
      }
    }
    const cave = this.cave;
    if (!cave) return;
    const near = Math.hypot(p.x - CAVE_FRAME.x, p.z - CAVE_FRAME.z) < 60;
    if (near !== this.caveNear) { this.caveNear = near; if (this.shaft) this.shaft.visible = near; if (this.drips) this.drips.visible = near; }
    if (!near) return;
    if (this.shaft && this.shaft.material instanceof THREE.ShaderMaterial) {
      const u = this.shaft.material.uniforms;
      // the sky over the crack: bright by day (the lamps are out), a glimmer at night
      const day = 1 - Math.max(0, Math.min(1, sky.lamps));
      const uI = u['uI'], uT = u['uTime'];
      CAVE_FILL.value = 0.05 + 1.6 * day;
      if (uI) uI.value = 0.2 * day * Math.min(1, 0.4 + Math.max(0, sky.sunDir.y) * 2) + 0.02;
      if (uT) uT.value = t;
    }
    if (this.drips) {
      const pos = this.drips.geometry.getAttribute('position');
      const s = this.dripState, n = s.length / 4;
      for (let i = 0; i < n; i++) {
        const top = s[i * 4 + 1] ?? 0, floor = s[i * 4 + 3] ?? 0, h = Math.max(0.2, top - floor);
        // each drip: forms for a while (hangs at the roof), then falls under gravity to the floor
        const period = 1.7 + (i % 5) * 0.53, ph = (t / period + i * 0.37) % 1;
        const fall = Math.sqrt((2 * h) / 9.8) / period;
        const k = ph < 1 - fall ? 0 : (ph - (1 - fall)) / fall;
        pos.setY(i, top - 0.04 - 0.5 * 9.8 * (k * fall * period) ** 2 * (k > 0 ? 1 : 0));
      }
      pos.needsUpdate = true;
    }
  }
}

/** a convex hull (≤ `maxPts` of the geometry's vertices, placed), relative to the placement's position */
function hullOf(g: THREE.BufferGeometry, m: THREE.Matrix4, p: CragPlace, maxPts: number): ColliderDesc {
  const pos = g.getAttribute('position');
  const step = Math.max(1, Math.floor(pos.count / maxPts));
  const pts = new Float32Array(Math.ceil(pos.count / step) * 3);
  const v = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts[k++] = v.x - p.x; pts[k++] = v.y - p.y; pts[k++] = v.z - p.z; }
  return { kind: 'hull', x: p.x, y: p.y, z: p.z, points: pts.subarray(0, k), surface: 'rock' };
}

/** the geometry placed by `m` as a trimesh relative to m's translation */
function trimeshOf(g: THREE.BufferGeometry, m: THREE.Matrix4): ColliderDesc {
  const pos = g.getAttribute('position');
  const o = new THREE.Vector3().setFromMatrixPosition(m);
  const verts = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); verts[i * 3] = v.x - o.x; verts[i * 3 + 1] = v.y - o.y; verts[i * 3 + 2] = v.z - o.z; }
  const idx = g.getIndex();
  const indices = idx ? Uint32Array.from({ length: idx.count }, (_v, i) => idx.getX(i)) : Uint32Array.from({ length: pos.count }, (_v, i) => i);
  return { kind: 'trimesh', x: o.x, y: o.y, z: o.z, vertices: verts, indices, surface: 'rock' };
}

/** pure helpers for the tests */
export const _cragTest = { slopeAt, blocked, cragCountry, ss };

/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * One InstancedMesh per plant (one draw each, no shadow casting), refilled from 16 m cells round the viewer whenever it
 * has moved 4 m: each cell's candidates are generated once (deterministic, from the cell's hash) and cached, then the
 * ones that can show from here are copied into the instance buffers — no per-frame allocation. The vertex shader bends
 * the blades away from the player's legs and sways them in the wind (`GroundCover.wind`, 0..1 — the shared gust M5
 * drives), and grows each plant in by its distance to the camera (E117, below).
 *
 * E117 — no ring, no pop. Each kind has a reach [near, far] (m, camera to plant, in 3D so a high Explore camera sees
 * none rather than a disc of it): every plant inside `near` stands, and past it each one has its own edge somewhere in
 * [near, far] (drawn from its yaw, which the shader reads back from the matrix), where it shrinks into the ground over
 * `grow` m. So the cover thins out over ~25 m instead of stopping in a line 25 m out, and what comes in as you fly is
 * one small plant at a time growing, far away. The refill only copies plants that can reach their edge before the
 * next refill (their edge + REFILL_M), so nothing is ever inserted part-grown. The desktop reaches 1.25× further.
 * And past `near` a plant takes on the ground it stands on — the terrain's own facet colour (`aGround`, per instance)
 * and an up-facing normal — so by the time it shrinks away it is already the colour and shade of the grass around it:
 * the thinning band has no edge to see. Debug ▸ Ground cover ▸ Far colour blend turns that off (the plants keep their colours to their edge).
 *
 * E117 follow-up (the user: "more distant cover") — the far tier. Tufts, ferns, hibiscus, bushes and daisies each get a
 * far model of 3–8 triangles (for tufts only 60 % of them, a little bigger) (the same silhouette at 25 m+, its flowers as flat colour chips). Past its near edge a
 * plant cross-fades into its far model (one shrinks as the other grows, same spot), which keeps the plant's colours out
 * to a second per-plant edge in [farNear, farFar] (phone: tufts 26–60 m, bushes 30–76 m), thins out plant by plant there
 * and only then takes on the ground's colour and shrinks. So the island stays dressed from Explore's height and far
 * out, with the same no-ring, no-pop rules. The far set is rebuilt every FAR_REFILL_M of travel by a job that runs a
 * slice of cells per frame (FAR_BUDGET_MS) into staging buffers and swaps them in when done, with FAR_SLACK m of room,
 * so neither the refill nor new cells hitch a frame. Debug ▸ Ground cover ▸ Far stand-ins: Off is the near tier alone (the first
 * E117 fix), Far reaches 1.5× further again.
 *
 * E156 — the ground wears the cover. Past the far tier the terrain was bare facets, so plants still seemed to appear as
 * you neared them. `fillCoverGrid` writes what the cover makes the ground look like into coverTint.ts's grid, the
 * terrains draw it (more of it the flatter they are seen), and a fading plant takes on that colour, not the bare facet's
 * (Debug ▸ Ground cover ▸ Ground tint). Plants on sloping ground keep up to 1.7× their reach (a slope facing you fills the
 * screen; Debug ▸ Ground cover ▸ Slope reach). No URL switches (Jake, 2026-09-25): every one of these is in the debug menu.
 *
 *   const cover = new GroundCover(sky, { sea: sea.level }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * Placement follows the terrain's own paint (Terrain.ts lowPolyGroundColor): grass above ~3 m over the sea on slopes
 * under 0.24, sand below; never on the sand paths, on steep rock, in the water, or inside a POI's footprint.
 */
import * as THREE from 'three';
import { heightAt, normalAt, trailDistance } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { LowPolyKit, fern, hibiscus, grassTuft, rock, log, broadClump, tris, lowPolyMaterial, PLANT, type Part } from './lowpolyKit';
import { addDriftLog, DRIFT } from './driftwood';
import { HUT, LOOKOUT, SHRINE, WRECK, ISLAND } from '../chunks/driftwood-isle';
import { Cove } from './Cove';
import { windUniforms } from './wind';
import { rockGeometry } from './rockKit';
import { TIER } from '../core/tier';
import { lowPolyGroundColor } from './Terrain';
import { CoverGrid, COVER_SEEN_GLSL, coverTintUniform, coverSample, coverJitter, triAreas } from './coverTint';
import type { BlenderArea } from './blenderArea';
import { setting, onSettingChange } from '../ui/Settings';
import type { Sky } from './Sky';

export interface GroundCoverOpts {
  sea: number;
  /** the palms (Palms.scatterIsland): ferns, hibiscus and bushes crowd round their feet */
  palms?: { x: number; z: number }[];
}

const CELL = 16, REFILL_M = 4;
/** E117: the desktop's reach over the phone's (and its instance caps grow with the area) */
const REACH_K = TIER === 'desktop' ? 1.25 : 1, CAP_K = TIER === 'desktop' ? 3 : 1.8;
/** E117: far plants blend into the ground's colour and shade (1), or keep their own to the edge (0): Debug ▸ Far colour blend, live */
const blendUniform = { value: setting('coverBlend') === 'on' ? 1 : 0 };
onSettingChange('coverBlend', (v) => { blendUniform.value = v === 'on' ? 1 : 0; });
/** E117 follow-up: the far tier (Debug ▸ Far stand-ins: on / off / far, read at load) and how far it reaches over the phone numbers below */
const COVER_FAR = setting('coverFar');
const FAR_K = COVER_FAR === 'far' ? 1.5 : 1;
/** the far set is rebuilt every FAR_REFILL_M m, within FAR_BUDGET_MS a frame, with FAR_SLACK m of room either side */
const FAR_REFILL_M = 8, FAR_SLACK = 16, FAR_BUDGET_MS = TIER === 'desktop' ? 2 : 1.5;
/** shader modes: a near plant that just shrinks away / hands over to its far model; a far model */
const MODE_NEAR = 0, MODE_HANDOVER = 1, MODE_FAR = 2;
/** floats per cached candidate: x y z yaw scale · tint rgb · ground rgb · ground normal xyz · cover side · cover rgb top (E156) */
const STRIDE = 19;
/** the viewer is the player's feet in play; the camera is ~1.7 m over them */
const EYE_SLACK = 2;
/** a thin stem's end caps are never seen (in the ground, under the leaves or petals): keep the tube, drop the caps (E117) */
const openEnded = (parts: Part[]): Part[] => parts.map(([g, c]) => {
  const idx = g.getIndex(), side = g.groups[0];
  if (idx !== null && g.groups.length >= 2 && side !== undefined) { g.setIndex(Array.from(idx.array.slice(side.start, side.start + side.count))); g.clearGroups(); }
  return [g, c];
});
/** the shared wind the blades sway in (0 calm … 1 gusting); M5's palms.gust drives it */
export const coverWind = windUniforms.uGust;

interface FarTier {
  mesh: THREE.InstancedMesh;
  cap: number;
  /** (farNear, farFar, grow) m: the far model keeps to its own edge in [farNear + grow, farFar] */
  reach: THREE.Vector3;
  /** the share of the kind's plants that get a far model (drawn by a hash of the yaw), each scaled up by 1/√keep so the
   *  far cover keeps its coverage with fewer instances */
  keep: number;
  /** the next set, filled by the far job and copied in when it is done */
  stage: { mat: Float32Array; col: Float32Array | null; gnd: Float32Array; cov: Float32Array; nrm: Float32Array; n: number };
}

interface Kind {
  name: string;
  mesh: THREE.InstancedMesh;
  cap: number;
  far: FarTier | null;
  /** E117: (near, far, grow) m — full density inside near, thinning to none at far, each plant growing in over `grow` */
  reach: THREE.Vector3;
  /** instances per m² at (h over the sea, slope, trail distance, shrine distance) */
  density: (h: number, slope: number, td: number, shrineD: number, palm: number) => number;
  /** E156: its mean colour (linear) and, per plant at scale 1, the ground it covers from above and its upright
   *  cross-section (m²), for the cover grid */
  look: { r: number; g: number; b: number; top: number; side: number };
  scale: [number, number];
  /** per-instance tint (multiplies the vertex colours) */
  tint?: (h: number, rng: Rng, out: THREE.Color) => void;
}

const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * E156 C — reach by screen size. A slope rising in front of you fills far more of the screen than flat ground at the same
 * distance, so the edge of the cover showed there first. Plants on sloping ground keep their reach × up to REACH_UP
 * (SLOPE_LO … SLOPE_HI of `slope` = 1 − the ground normal's y; 0.01 ≈ 8°, 0.08 ≈ 23°); flat ground keeps today's. It is the
 * ground's own tilt, not the angle it is seen at: that changes as you walk, and the refill would have to include every
 * plant the next few metres could bring in — on the phone that was +68 % instances for flat ground. A plant's reach is
 * fixed, so the refill's rule stays exact (nothing inserted part-grown). It fades out as the camera climbs (REACH_HI m
 * over the ground): from Explore's height every slope is in view and the caps can't pay for it. Debug ▸ Slope reach (live).
 */
let coverReach = setting('coverReach') === 'on';
const REACH_UP = 1.7, SLOPE_LO = 0.01, SLOPE_HI = 0.08, REACH_HI: [number, number] = [5, 14];
/**
 * A cached candidate's reach factor (the shader's, from its normal's y) at the strength the camera's height allows, taken
 * at the most it can grow to before the next refill (`travel` m of climb or dive at most: the strength follows the height)
 */
const reachMax = (v: Float32Array, i: number, strength: number, travel: number): number => {
  const s = strength >= 1 ? 1 : Math.min(1, strength + travel / (REACH_HI[1] - REACH_HI[0]));
  return 1 + s * (REACH_UP - 1) * ss(SLOPE_LO, SLOPE_HI, 1 - (v[i + 12] ?? 1));
};

// ── the far models' pieces (E117 follow-up): one or two triangles each ──
/** a grass blade leaning out along yaw `a`: base width 2w, height h, lean (0 up … 1 flat) */
function bladeTri(a: number, w: number, h: number, lean: number): THREE.BufferGeometry {
  const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
  return tris([ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + Math.cos(a) * h * lean, h, oz + Math.sin(a) * h * lean]);
}
/** a flat flower chip of radius r, tipped by `tilt` rad: one triangle */
function chip(r: number, tilt: number): THREE.BufferGeometry {
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; v.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  return tris(v).rotateX(-tilt);
}
/** parts copied (the kit disposes what it is given) */
const cloneParts = (parts: Part[]): Part[] => parts.map(([g, c]) => [g.clone(), c]);
/**
 * E156: a plant's leaves as far-model kites. lowpolyKit's `leaf` is four triangles — base B, crease M, sides L / R, tip T,
 * in the order [B M L] [B R M] [M T L] [M R T] — and becomes the two of its outline, [B L R] [L T R]. Anything that is
 * not a leaf (stems) is dropped. The parts are the near model's own, so the far one keeps its leaves where they are.
 */
const KITE_SHADE = 0.82;
function kites(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const [g, c] of parts) {
    const p = g.getAttribute('position');
    if (g.getIndex() !== null || p.count !== 12) continue;
    const at = (i: number): [number, number, number] => [p.getX(i), p.getY(i), p.getZ(i)];
    const B = at(0), L = at(2), R = at(4), T = at(7);
    // ×KITE_SHADE: a kite is one flat face, where the leaf's crease put half of it in its own shade (measured: the kites
    // read 8 % brighter than the leaves they stand for, at the dune fringe, phone tier)
    out.push([tris([...B, ...L, ...R, ...L, ...T, ...R]), new THREE.Color(c).multiplyScalar(KITE_SHADE)]);
  }
  return out;
}

/**
 * E156: a plant model's mean colour (its vertex colours weighted by triangle area) and its ground / upright areas (the
 * sum of its triangles' projections, ×OVERLAP for the fronds that hide each other), for the cover grid.
 */
const OVERLAP = 0.6;
function lookOf(g: THREE.BufferGeometry): Kind['look'] {
  const pos = g.getAttribute('position'), col = g.getAttribute('color'), idx = g.getIndex();
  let r = 0, gg = 0, bb = 0, w = 0, top = 0, side = 0;
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    const ar = triAreas(pos.getX(i0), pos.getY(i0), pos.getZ(i0), pos.getX(i1), pos.getY(i1), pos.getZ(i1), pos.getX(i2), pos.getY(i2), pos.getZ(i2));
    const area = ar.top + ar.side;
    r += col.getX(i2) * area; gg += col.getY(i2) * area; bb += col.getZ(i2) * area; w += area;
    top += ar.top; side += ar.side;
  }
  return w > 0 ? { r: r / w, g: gg / w, b: bb / w, top: top * OVERLAP, side: side * OVERLAP } : { r: 0, g: 0, b: 0, top: 0, side: 0 };
}

export class GroundCover {
  group = new THREE.Group();
  private kinds: Kind[] = [];
  private cells = new Map<string, Float32Array[]>();
  private last = new THREE.Vector3(1e9, 0, 1e9);
  private uniforms = { uPlayer: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: coverWind, uReachUp: { value: coverReach ? 1 : 0 } };
  /** E156: the Blender island's area once it has loaded — its own cover dresses it, so no plant of ours is placed there */
  private skip: BlenderArea | null = null;
  /** the furthest any plant shows + a refill's travel: the cell window's radius */
  private rMax = 0;
  private cacheMax = 96;
  private avoid: { x: number; z: number; r: number }[] = [];
  private tint = new THREE.Color();
  private ground = new THREE.Color();
  private cover = coverSample();
  /** the far tier's rebuild: a job stepped within FAR_BUDGET_MS a frame; where the shown / the next set were built from */
  private farJob: Generator<undefined, undefined, undefined> | null = null;
  private farLast = new THREE.Vector3(1e9, 0, 1e9);
  private farJobAt = new THREE.Vector3();
  private rFar = 0;
  /** 0 → 1 over ~0.8 s when a far set lands somewhere new (boot, a teleport), so it grows in instead of appearing */
  private farIn = { value: 1 };
  /** measurements for scripts/popin-fly.mjs (group.userData.stats) */
  readonly stats = { nearRefillMs: 0, farJobMs: 0, farJobFrames: 0, farCells: 0, farCount: 0, cellsBuilt: 0, gridMs: 0 };

  constructor(private sky: Sky, private opts: GroundCoverOpts) {
    // Debug ▸ Slope reach, live: the next frame refills both tiers with the new reach
    onSettingChange('coverReach', (v) => { coverReach = v === 'on'; this.last.set(1e9, 0, 1e9); this.farLast.set(1e9, 0, 1e9); });
    const cave = Cove.forIsland().cave;
    this.avoid = [
      { x: HUT.x, z: HUT.z, r: 9 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 8 }, { x: SHRINE.x, z: SHRINE.z, r: 9.5 },
      { x: WRECK.x, z: WRECK.z, r: 13 }, { x: cave.x, z: cave.z + cave.depth / 2, r: 8 },
      { x: 0, z: -151, r: 3.2 },                                   // the pier's landing
    ];
    for (const p of opts.palms ?? []) {
      const k = `${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`;
      const list = this.palmGrid.get(k);
      if (list) list.push(p); else this.palmGrid.set(k, [p]);
    }
  }

  private palmGrid = new Map<string, { x: number; z: number }[]>();
  /** 1 at a palm's foot, fading out by 3.5 m */
  private nearPalm(x: number, z: number): number {
    let best = 0;
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of this.palmGrid.get(`${gx + dx},${gz + dz}`) ?? []) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 3.5) best = Math.max(best, 1 - ss(1.0, 3.5, d));
    }
    return best;
  }

  build(): this {
    // one material per kind (its own reach uniform), one program for all of them
    const material = (reach: THREE.Vector3, far: THREE.Vector3, mode: number): THREE.MeshStandardMaterial => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
      this.patch(mat, reach, far, mode);
      this.sky.setupMaterial(mat);
      return mat;
    };
    const geo = (parts: Part[] | ((k: LowPolyKit) => void), seed: number): THREE.BufferGeometry => {
      const kit = new LowPolyKit(SEED ^ seed);
      if (typeof parts === 'function') parts(kit); else kit.addParts(parts, { jitter: 0.08 });
      return kit.finish({ ao: false });
    };
    const rng = new Rng(SEED ^ 0x6c0e);
    // a tuft: two bunches of blades so one instance reads as a clump
    const tuftGeo = geo((k) => { k.addParts(grassTuft(rng, 0.42), { jitter: 0.08 }); k.addParts(grassTuft(rng, 0.32), { matrix: new THREE.Matrix4().makeTranslation(0.12, 0, 0.08), jitter: 0.08 }); }, 0x6c01);
    const fernParts = fern(rng, 0.75);
    const fernGeo = geo(cloneParts(fernParts), 0x6c02);
    /** the hibiscus's leaves (drawn inside its kit callback, in the same order as before: the rng sequence holds) */
    let hibParts: Part[] = [];
    const hibGeo = geo((k) => {
      hibParts = fern(rng, 0.42);
      k.addParts(cloneParts(hibParts), { jitter: 0.08 });
      for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.addParts(openEnded(hibiscus(0.09)), { matrix: new THREE.Matrix4().makeRotationX(-0.5).setPosition(x, y, z), jitter: 0.05 });
    }, 0x6c03);
    const daisyGeo = geo((k) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + rng.range(0, 0.6), d = rng.range(0.05, 0.2), h = rng.range(0.14, 0.26), x = Math.cos(a) * d, z = Math.sin(a) * d;
        k.add(new THREE.CylinderGeometry(0.008, 0.01, h, 3, 1, true).translate(x, h / 2, z), PLANT.stem);
        const petals: number[] = [];
        for (let p = 0; p < 6; p++) { const b = (p / 6) * Math.PI * 2; petals.push(x, h, z, x + Math.cos(b) * 0.05, h + 0.005, z + Math.sin(b) * 0.05, x + Math.cos(b + 0.5) * 0.05, h + 0.005, z + Math.sin(b + 0.5) * 0.05); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(petals, 3));
        k.add(g, i % 2 ? '#f6f2e6' : '#fbe9a0', { jitter: 0.03 });
        k.add(new THREE.OctahedronGeometry(0.018, 0).translate(x, h + 0.01, z), PLANT.stamen);
      }
      k.addParts(grassTuft(rng, 0.2), { jitter: 0.08 });
    }, 0x6c04);
    const rockRng = new Rng(SEED ^ 0x70c6);
    const pebbleGeo = geo((k) => {
      for (let i = 0; i < 3; i++) {
        const r = rng.range(0.1, 0.22), a = rng.range(0, 6.28), d = i === 0 ? 0 : rng.range(0.2, 0.35);
        const m = new THREE.Matrix4().makeTranslation(Math.cos(a) * d, r * 0.2, Math.sin(a) * d);
        // E114: the pebbles are rockKit rocks too (flat-shaded here: the ground cover is one faceted material). The old
        // pebble is still built for the draws it takes, so everything after is placed as it always was
        rock(r, 0, rng, 0.6, 0.25).dispose();
        k.addPainted(rockGeometry(r, rockRng, { squash: 0.6, moss: 0.5, ground: -0.2 * r }), m);
      }
    }, 0x6c05);

    const beach = (h: number) => ss(0.5, 1.2, h) * (1 - ss(2.0, 3.2, h));
    const grass = (h: number, slope: number) => ss(2.6, 4.2, h) * (1 - ss(0.18, 0.26, slope));
    const off = (td: number) => ss(2.6, 4.0, td);
    const jungle = (sd: number) => 1 - ss(18, 45, sd);
    const instanced = (name: string, g: THREE.BufferGeometry, mat: THREE.Material, cap: number, tinted: boolean): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(g, mat, cap);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;                           // the window moves with the player; one sphere per refill would do too
      mesh.castShadow = false; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tinted) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      const ground = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      ground.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aGround', ground);
      for (const [attr, w] of [['aCover', 4], ['aNrm', 4]] as const) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * w), w); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(attr, a); }
      this.group.add(mesh);
      return mesh;
    };
    /** `farOf`: [far model, [farNear, farFar] m, cap, keep] — the far tier (none when Debug ▸ Far stand-ins is Off) */
    const kind = (name: string, g: THREE.BufferGeometry, cap0: number, [near, far]: [number, number], scale: [number, number], density: Kind['density'], tint?: Kind['tint'], farOf?: [THREE.BufferGeometry, [number, number], number, number]): void => {
      const cap = Math.round(cap0 * CAP_K);
      const reach = new THREE.Vector3(near * REACH_K, far * REACH_K, (far - near) * REACH_K * 0.25);
      this.rMax = Math.max(this.rMax, reach.y * REACH_UP + REFILL_M + EYE_SLACK); // sized for the slope reach, which can be switched on live
      let farTier: FarTier | null = null;
      const farReach = new THREE.Vector3(0, 0, 1);
      if (farOf && COVER_FAR !== 'off') {
        const [fg, [fn, ff], fcap0, keep] = farOf, k = REACH_K * FAR_K, fcap = Math.round(fcap0 * keep * CAP_K * FAR_K * FAR_K);
        farReach.set(fn * k, ff * k, (ff - fn) * k * 0.25);
        this.rFar = Math.max(this.rFar, farReach.y * REACH_UP + FAR_SLACK + EYE_SLACK);
        farTier = {
          mesh: instanced(`ground-cover-${name}-far`, fg, material(reach, farReach, MODE_FAR), fcap, tint !== undefined), cap: fcap, reach: farReach, keep,
          stage: { mat: new Float32Array(fcap * 16), col: tint ? new Float32Array(fcap * 3) : null, gnd: new Float32Array(fcap * 3), cov: new Float32Array(fcap * 4), nrm: new Float32Array(fcap * 4), n: 0 },
        };
      }
      const mesh = instanced(`ground-cover-${name}`, g, material(reach, farReach, farTier ? MODE_HANDOVER : MODE_NEAR), cap, tint !== undefined);
      this.kinds.push({ name, mesh, cap, far: farTier, reach, density, scale, look: lookOf(g), ...(tint ? { tint } : {}) });
    };
    // the far models: a few triangles each, the near model's silhouette from 25 m on (its flowers as flat chips)
    const farRng = new Rng(SEED ^ 0x6cf0);
    // E156: the fern, hibiscus and bush far models are their near models' own leaves as 2-triangle kites (the same outline,
    // no crease), so the plant keeps its silhouette through the handover. The old hand-made ones showed 15–28 % of the
    // near plant's side-on area and grew 4–7× in view as you crossed the near edge: the pop Jake filmed at the dune fringe.
    const farTuftGeo = geo((k) => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + farRng.range(-0.4, 0.4); k.add(bladeTri(a, 0.09, farRng.range(0.32, 0.46), farRng.range(0.2, 0.45)), [PLANT.grassTip, PLANT.grass, PLANT.grassB][i] ?? PLANT.grass); } }, 0x6cf1);
    const farFernGeo = geo(kites(fernParts), 0x6cf2);
    const farHibGeo = geo((k) => {
      k.addParts(kites(hibParts), { jitter: 0.08 });
      for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.add(chip(0.1, 0.5).translate(x, y, z), PLANT.hibiscus);
    }, 0x6cf3);
    const farDaisyGeo = geo((k) => {
      for (let i = 0; i < 2; i++) k.add(bladeTri(i * Math.PI, 0.03, 0.18, 0.3), PLANT.grass);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, d = farRng.range(0.08, 0.2); k.add(chip(0.065, 0).translate(Math.cos(a) * d, farRng.range(0.14, 0.26), Math.sin(a) * d), i % 2 ? '#f6f2e6' : '#fbe9a0'); }
    }, 0x6cf4);
    kind('tuft', tuftGeo, 5200, [14, 34], [0.9, 1.5],
      (h, sl, td) => (grass(h, sl) * 1.6 + beach(h) * 0.18 + this.dune(h) * 0.7) * off(td),
      (h, r, out) => { const b = beach(h); out.setRGB(1 + b * 0.35 + r.range(-0.08, 0.08), 1 + b * 0.12 + r.range(-0.06, 0.06), 1 - b * 0.35); },
      [farTuftGeo, [26, 60], 16000, 0.6]);
    kind('fern', fernGeo, 1400, [14, 34], [0.7, 1.4], (h, sl, td, sd, palm) => (grass(h, sl) * (0.03 + jungle(sd) * 0.35) + this.edge(h, sl) * 0.45 + palm * 0.45) * off(td), undefined, [farFernGeo, [26, 60], 4400, 1]);
    kind('hibiscus', hibGeo, 900, [14, 34], [0.8, 1.3], (h, sl, td, sd, palm) => (grass(h, sl) * (0.025 + jungle(sd) * 0.08) + this.edge(h, sl) * 0.3 + palm * 0.28) * off(td), undefined, [farHibGeo, [26, 64], 3200, 1]);
    kind('daisy', daisyGeo, 800, [9, 22], [0.8, 1.4], (h, sl, td) => (grass(h, sl) * 0.07 + this.edge(h, sl) * 0.3) * off(td), undefined, [farDaisyGeo, [16, 40], 1600, 1]);
    kind('pebble', pebbleGeo, 400, [9, 22], [0.7, 1.5], (h, sl, td) => (grass(h, sl) * 0.03 + beach(h) * 0.05) * (0.4 + 0.6 * off(td)));
    // (E43) the beach: a shell / starfish / pebble scatter every 1-2 m on the sand, beach grass on the dune crest, and a
    // dense fringe of ferns, hibiscus, flowers and bushes along the sand -> grass edge and round every palm's foot
    const shellGeo = geo((k) => {
      const shell = (x: number, z: number, r: number, col: string) => {
        const v: number[] = [];
        for (let i = 0; i < 5; i++) { const a0 = -0.9 + i * 0.36, a1 = a0 + 0.36; v.push(x, 0.02, z - r * 0.5, x + Math.sin(a0) * r, 0.02 + r * 0.25 * Math.cos(a0 * 1.2), z + Math.cos(a0) * r * 0.6, x + Math.sin(a1) * r, 0.02 + r * 0.25 * Math.cos(a1 * 1.2), z + Math.cos(a1) * r * 0.6); }
        k.add(tris(v), col, { jitter: 0.08 });
      };
      shell(0, 0, 0.09, '#f3e6d4'); shell(0.35, 0.25, 0.07, '#f0c9b8'); shell(-0.28, 0.18, 0.06, '#e9dcc8');
      k.addTopped(rock(0.07, 0, rng, 0.6, 0.25), '#8d8a84', '#9a968e', { matrix: new THREE.Matrix4().makeTranslation(0.2, 0.01, -0.3), jitter: 0.08 });
      k.addTopped(rock(0.05, 0, rng, 0.6, 0.25), '#a7a39b', '#b0aca4', { matrix: new THREE.Matrix4().makeTranslation(-0.1, 0.01, -0.35), jitter: 0.08 });
    }, 0x6c06);
    kind('shells', shellGeo, 1600, [10, 26], [1.3, 2.3], (h) => beach(h) * 0.8,
      (_h, r, out) => { const v = r.next(); out.setRGB(v < 0.3 ? 1.0 : 1.05, v < 0.3 ? 0.85 : 1.0, 0.95); });
    const starGeo = geo((k) => {
      const v: number[] = [];
      for (let a = 0; a < 5; a++) { const t = (a / 5) * Math.PI * 2, l = t + 0.63, rr = t - 0.63; v.push(0, 0.05, 0, Math.cos(rr) * 0.042, 0.01, Math.sin(rr) * 0.042, Math.cos(t) * 0.12, 0.01, Math.sin(t) * 0.12, 0, 0.05, 0, Math.cos(t) * 0.12, 0.01, Math.sin(t) * 0.12, Math.cos(l) * 0.042, 0.01, Math.sin(l) * 0.042); }
      k.add(tris(v), '#f07a3a', { jitter: 0.06 });
    }, 0x6c09);
    kind('starfish', starGeo, 300, [8, 20], [1.1, 1.8], (h) => beach(h) * 0.09,
      (_h, r, out) => { const v = r.next(); if (v < 0.25) out.setRGB(0.55, 0.45, 1.3); else if (v < 0.5) out.setRGB(1.05, 0.95, 0.6); else out.setRGB(1, 1, 1); });
    const bushParts = openEnded(broadClump(rng, 1.0));
    const bushGeo = geo(cloneParts(bushParts), 0x6c07), farBushGeo = geo(kites(bushParts), 0x6cf5);
    kind('bush', bushGeo, 900, [16, 38], [0.8, 1.6], (h, sl, td, sd, palm) => (this.edge(h, sl) * 0.3 + palm * 0.3 + grass(h, sl) * 0.015) * off(td) + jungle(sd) * grass(h, sl) * 0.06, undefined, [farBushGeo, [30, 76], 4000, 1]);
    const span = Math.ceil((2 * Math.max(this.rMax, this.rFar)) / CELL) + 1;
    this.cacheMax = Math.max(96, Math.round(span * span * 1.4));
    this.group.userData['stats'] = this.stats;
    this.fillCoverGrid();
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
  }

  /**
   * E156: the chunk's cover grid from the same rules the cells place by — per 4 m, each kind's expected plants per m²
   * (≈ 2.03 candidates per m², each kept with p = density / 2) × the ground one covers × its colour.
   */
  private fillCoverGrid(): void {
    const sea = this.opts.sea, grid = CoverGrid.create(), per = 520 / (CELL * CELL), col = new THREE.Color();
    const t0 = performance.now();
    grid.fill((x, z, out) => {
      if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) return;
      const h = heightAt(x, z) - sea;
      if (h < 0.4) return;
      const [, ny] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) return;
      const td = trailDistance(x, z), sd = Math.hypot(x - SHRINE.x, z - SHRINE.z), palm = this.nearPalm(x, z);
      let top = 0, side = 0;
      col.setRGB(0, 0, 0);
      for (const k of this.kinds) {
        const n = per * Math.min(1, Math.max(0, k.density(h, slope, td, sd, palm)) / 2), s = (k.scale[0] + k.scale[1]) / 2, ns = n * s * s;
        const t = ns * k.look.top, sd2 = ns * k.look.side, wt = t + sd2;
        top += t; side += sd2; col.r += k.look.r * wt; col.g += k.look.g * wt; col.b += k.look.b * wt;
      }
      const w = top + side;
      if (w > 0) { out.r = col.r / w; out.g = col.g / w; out.b = col.b / w; out.top = 1 - Math.exp(-top); out.side = 1 - Math.exp(-side); }
    }, ISLAND.x - ISLAND.r - 40, ISLAND.x + ISLAND.r + 40, ISLAND.z - ISLAND.r - 40, ISLAND.z + ISLAND.r + 40);
    this.stats.gridMs = performance.now() - t0;
  }

  /** E156: the Blender island loaded — it dresses its own area, so the cells stop placing plants there (they were clipped
   *  in its shader, but each still took an instance and its vertices) */
  excludeArea(a: BlenderArea): void {
    this.skip = a;
    this.cells.clear();
    this.last.set(1e9, 0, 1e9); this.farLast.set(1e9, 0, 1e9);
  }

  /** the sand -> grass edge (the plant fringe) and the dune crest (beach grass) */
  private edge = (h: number, sl: number): number => ss(1.9, 2.7, h) * (1 - ss(4.8, 7, h)) * (1 - ss(0.2, 0.3, sl));
  private dune = (h: number): number => ss(1.2, 1.8, h) * (1 - ss(2.6, 3.4, h));

  /** bleached driftwood logs (the E149 painter, driftwood.ts) along the dune line all round the island, one every ~9 m (one static mesh) */
  private buildDriftwood(): void {
    const kit = new LowPolyKit(SEED ^ 0x6c08), rng = kit.rng, sea = this.opts.sea;
    for (let a = 0; a < Math.PI * 2; a += 9 / 200) {
      const dx = Math.cos(a), dz = Math.sin(a);
      // march outward from inland to the first sand below the dune crest (~1.6 m over the sea)
      let r = 120, found = false;
      for (; r < 250; r += 1) { const x = ISLAND.x + dx * r, z = ISLAND.z + dz * r; if (heightAt(x, z) - sea < 1.6) { found = true; break; } }
      if (!found || rng.next() < 0.2) continue;
      const x = ISLAND.x + dx * (r - rng.range(0, 3)), z = ISLAND.z + dz * (r - rng.range(0, 3));
      if (Math.abs(x) > 245 || Math.abs(z) > 245) continue;
      if (this.avoid.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 3) ** 2) || trailDistance(x, z) < 3.5) continue;
      const n = rng.next() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const len = rng.range(2.2, 4.2), rad = rng.range(0.12, 0.24), yaw = a + Math.PI / 2 + rng.range(-0.6, 0.6) + k * 1.1;
        const hx = Math.cos(yaw) * len / 2, hz = Math.sin(yaw) * len / 2;
        const A = new THREE.Vector3(x - hx, heightAt(x - hx, z - hz) + rad * 0.7 + k * 0.2, z - hz), B = new THREE.Vector3(x + hx, heightAt(x + hx, z + hz) + rad * 0.7 + k * 0.2, z + hz);
        addDriftLog(kit, A, B, rad, rad * 0.7, { sides: 6, twist: rng.range(0, 1), tone: k + Math.floor(a * 10), wobble: 0.02 });
        if (rng.next() < 0.5) { const m = A.clone().lerp(B, rng.range(0.3, 0.7)); kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(0.25, 0.5), rng.range(-0.3, 0.3))), rad * 0.4, rad * 0.25, 5), DRIFT.stub); }
      }
    }
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.35, strength: 0.5 } });
    const mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    mesh.name = 'ground-cover-driftwood';
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** a cell's candidates per kind: [x, y, z, yaw, scale, r, g, b, ground r, g, b] × n — generated once, then cached */
  private cell(cx: number, cz: number): Float32Array[] {
    const key = `${cx},${cz}`;
    const hit = this.cells.get(key);
    if (hit) return hit;
    const rng = new Rng(SEED ^ Math.imul(cx + 1013, 73856093) ^ Math.imul(cz + 2027, 19349663));
    const sea = this.opts.sea;
    const vals: number[][] = this.kinds.map(() => []);
    const grid = CoverGrid.get();
    // one candidate set per cell (≈ 2 per m²), the terrain read once per point, then a density lottery per kind
    const n = 520;
    for (let i = 0; i < n; i++) {
      const x = (cx + rng.next()) * CELL, z = (cz + rng.next()) * CELL;
      if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) continue;
      const sk = this.skip;
      if (sk && x > sk.x0 && x < sk.x1 && z > sk.z0 && z < sk.z1) continue;
      const y = heightAt(x, z), h = y - sea;
      if (h < 0.4) continue;
      const [nx, ny, nz] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) continue;
      const td = trailDistance(x, z), sd = Math.hypot(x - SHRINE.x, z - SHRINE.z), palm = this.nearPalm(x, z);
      this.kinds.forEach((k, ki) => {
        const d = k.density(h, slope, td, sd, palm);
        if (rng.next() * 2 > d) return;
        const jx = x + rng.range(-0.3, 0.3), jz = z + rng.range(-0.3, 0.3), sc = rng.range(k.scale[0], k.scale[1]);
        if (k.tint) k.tint(h, rng, this.tint); else this.tint.setRGB(1, 1, 1);
        const jy = heightAt(jx, jz), yaw = rng.range(0, Math.PI * 2);
        lowPolyGroundColor(this.ground, jy - sea, slope, jx, jz);
        const cv = this.cover;
        if (grid) grid.sample(jx, jz, cv); else { cv.r = 0; cv.g = 0; cv.b = 0; cv.top = 0; cv.side = 0; }
        const j = coverJitter(jx, jz);
        vals[ki]?.push(jx, jy - 0.02, jz, yaw, sc, this.tint.r, this.tint.g, this.tint.b, this.ground.r, this.ground.g, this.ground.b, nx, ny, nz, cv.side, cv.r * j, cv.g * j, cv.b * j, cv.top);
      });
    }
    const out = vals.map((v) => new Float32Array(v));
    if (this.cells.size > this.cacheMax) { const first = this.cells.keys().next().value; if (first !== undefined) this.cells.delete(first); }
    this.cells.set(key, out);
    return out;
  }

  /** copy every cached plant that can show before the next refill (its edge + REFILL_M) into its kind's buffers */
  private refill(px: number, py: number, pz: number): void {
    const t0 = performance.now();
    const R = this.rMax, c0x = Math.floor((px - R) / CELL), c1x = Math.floor((px + R) / CELL), c0z = Math.floor((pz - R) / CELL), c1z = Math.floor((pz + R) / CELL);
    const counts = this.kinds.map(() => 0);
    const TAU = Math.PI * 2, up = this.uniforms.uReachUp.value;
    // nearest cells first (E156): a kind that runs into its cap then drops its furthest (thinnest) plants, not a corner
    const order: [number, number, number][] = [];
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const dx = Math.max(0, cx * CELL - px, px - (cx + 1) * CELL), dz = Math.max(0, cz * CELL - pz, pz - (cz + 1) * CELL);
      if (dx * dx + dz * dz <= R * R) order.push([cx, cz, dx * dx + dz * dz]);
    }
    order.sort((a, b) => a[2] - b[2]);
    for (const [cx, cz] of order) {
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const v = data[ki];
        if (v === undefined) return;
        const near = k.reach.x, far = k.reach.y, grow = k.reach.z, slack = REFILL_M + EYE_SLACK;
        const mat = k.mesh.instanceMatrix.array as Float32Array, col = k.mesh.instanceColor ? (k.mesh.instanceColor.array as Float32Array) : null;
        const gnd = k.mesh.geometry.getAttribute('aGround').array as Float32Array;
        const cov = k.mesh.geometry.getAttribute('aCover').array as Float32Array, nrm = k.mesh.geometry.getAttribute('aNrm').array as Float32Array;
        let n = counts[ki] ?? 0;
        for (let i = 0; i < v.length && n < k.cap; i += STRIDE) {
          const x = v[i] ?? 0, y = v[i + 1] ?? 0, z = v[i + 2] ?? 0, yaw = v[i + 3] ?? 0;
          // this plant's edge (the shader's): yaw / 2π; round the wrap (the GPU's atan may land either side) to the far end
          const d2 = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2, rk = coverReach ? reachMax(v, i, up, REFILL_M + EYE_SLACK) : 1;
          const h = yaw / TAU, edge = (h < 0.005 || h > 0.995 ? far : near + grow + (far - near - grow) * h) * rk, lim = edge + slack;
          if (d2 > lim * lim) continue;
          const s = v[i + 4] ?? 1, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16;
          // a turn about +y, scaled: what Matrix4.compose writes, without the quaternion
          mat[o] = c; mat[o + 1] = 0; mat[o + 2] = -sn; mat[o + 3] = 0;
          mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0;
          mat[o + 8] = sn; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
          mat[o + 12] = x; mat[o + 13] = y; mat[o + 14] = z; mat[o + 15] = 1;
          if (col) { col[n * 3] = v[i + 5] ?? 1; col[n * 3 + 1] = v[i + 6] ?? 1; col[n * 3 + 2] = v[i + 7] ?? 1; }
          gnd[n * 3] = v[i + 8] ?? 0; gnd[n * 3 + 1] = v[i + 9] ?? 0; gnd[n * 3 + 2] = v[i + 10] ?? 0;
          nrm.set(v.subarray(i + 11, i + 15), n * 4); cov.set(v.subarray(i + 15, i + 19), n * 4);
          n++;
        }
        counts[ki] = n;
      });
    }
    this.kinds.forEach((k, ki) => {
      k.mesh.count = counts[ki] ?? 0;
      k.mesh.instanceMatrix.needsUpdate = true;
      if (k.mesh.instanceColor) k.mesh.instanceColor.needsUpdate = true;
      for (const a of ['aGround', 'aCover', 'aNrm']) k.mesh.geometry.getAttribute(a).needsUpdate = true;
    });
    this.stats.nearRefillMs = performance.now() - t0;
  }

  /**
   * The far tier's rebuild, a slice of cells per step (nearest first): every plant whose far model can show before the
   * next rebuild lands — past its near edge less FAR_SLACK, inside its far edge plus FAR_SLACK — into the staging
   * buffers, which are copied in at the end. A cap cuts the furthest (thinnest) first.
   */
  private *farRefill(px: number, py: number, pz: number): Generator<undefined, undefined, undefined> {
    const R = this.rFar, c0x = Math.floor((px - R) / CELL), c1x = Math.floor((px + R) / CELL), c0z = Math.floor((pz - R) / CELL), c1z = Math.floor((pz + R) / CELL);
    const cellsAt: [number, number, number][] = [];
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const dx = Math.max(0, cx * CELL - px, px - (cx + 1) * CELL), dz = Math.max(0, cz * CELL - pz, pz - (cz + 1) * CELL);
      if (dx * dx + dz * dz <= R * R) cellsAt.push([cx, cz, dx * dx + dz * dz]);
    }
    cellsAt.sort((a, b) => a[2] - b[2]);
    for (const k of this.kinds) if (k.far) k.far.stage.n = 0;
    const TAU = Math.PI * 2, slack = FAR_SLACK + EYE_SLACK, up = this.uniforms.uReachUp.value;
    for (const [cx, cz] of cellsAt) {
      if (!this.cells.has(`${cx},${cz}`)) { this.cell(cx, cz); this.stats.cellsBuilt++; yield undefined; } // a new cell is its own slice
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const f = k.far, v = data[ki];
        if (f === null || v === undefined) return;
        const near = k.reach.x, grow = k.reach.z, far = k.reach.y, fNear = f.reach.x, fFar = f.reach.y, fGrow = f.reach.z;
        const st = f.stage, keep = f.keep, growK = 1 / Math.sqrt(keep);
        let n = st.n;
        for (let i = 0; i < v.length && n < f.cap; i += STRIDE) {
          const x = v[i] ?? 0, y = v[i + 1] ?? 0, z = v[i + 2] ?? 0, yaw = v[i + 3] ?? 0;
          const h = yaw / TAU, wrap = h < 0.005 || h > 0.995;
          if (keep < 1 && ((h * 97.13) % 1) >= keep) continue;           // not one of the kind's far plants
          const d2 = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2, rk = coverReach ? reachMax(v, i, up, FAR_SLACK) : 1;
          const edge = (wrap ? near + grow : near + grow + (far - near - grow) * h) * rk, fEdge = (wrap ? fFar : fNear + fGrow + (fFar - fNear - fGrow) * h) * rk;
          // the lower bound takes the plant's reach at 1× (the camera may climb and the strength fall before the next rebuild)
          const lo = Math.max(0, (edge / rk) - grow - slack), hi = fEdge + slack;
          if (d2 > hi * hi || d2 < lo * lo) continue;
          const s = (v[i + 4] ?? 1) * growK, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16, m = st.mat;
          m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
          m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
          m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
          m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
          if (st.col) { st.col[n * 3] = v[i + 5] ?? 1; st.col[n * 3 + 1] = v[i + 6] ?? 1; st.col[n * 3 + 2] = v[i + 7] ?? 1; }
          st.gnd[n * 3] = v[i + 8] ?? 0; st.gnd[n * 3 + 1] = v[i + 9] ?? 0; st.gnd[n * 3 + 2] = v[i + 10] ?? 0;
          st.nrm.set(v.subarray(i + 11, i + 15), n * 4); st.cov.set(v.subarray(i + 15, i + 19), n * 4);
          n++;
        }
        st.n = n;
      });
      yield undefined;
    }
    // swap in: copy what was staged (only that much is uploaded)
    let total = 0;
    for (const k of this.kinds) {
      const f = k.far;
      if (f === null) continue;
      const st = f.stage, n = st.n, mesh = f.mesh;
      const copy = (attr: THREE.BufferAttribute | THREE.InstancedBufferAttribute, src: Float32Array, w: number): void => {
        (attr.array as Float32Array).set(src.subarray(0, n * w));
        attr.clearUpdateRanges(); attr.addUpdateRange(0, Math.max(1, n * w)); attr.needsUpdate = true;
      };
      copy(mesh.instanceMatrix, st.mat, 16);
      if (mesh.instanceColor && st.col) copy(mesh.instanceColor, st.col, 3);
      const gnd = mesh.geometry.getAttribute('aGround'), cov = mesh.geometry.getAttribute('aCover'), nrm = mesh.geometry.getAttribute('aNrm');
      if (gnd instanceof THREE.BufferAttribute) copy(gnd, st.gnd, 3);
      if (cov instanceof THREE.BufferAttribute) copy(cov, st.cov, 4);
      if (nrm instanceof THREE.BufferAttribute) copy(nrm, st.nrm, 4);
      mesh.count = n;
      total += n;
    }
    this.stats.farCells = cellsAt.length; this.stats.farCount = total;
    // a set that lands somewhere new — the first one, a jump further than the window (Explore's teleports) — grows in over
    // ~0.8 s instead of appearing; flying, however fast, the sets overlap and simply follow
    if (this.farLast.distanceToSquared(this.farJobAt) > this.rFar * this.rFar) this.farIn.value = 0;
    this.farLast.copy(this.farJobAt);
    return undefined;
  }

  update(dt: number, viewer: THREE.Vector3): void {
    this.uniforms.uTime.value += dt;
    this.uniforms.uPlayer.value.copy(viewer);
    // E156 C: full strength on foot (the viewer is the player's feet), none from Explore's height
    this.uniforms.uReachUp.value = coverReach ? 1 - ss(REACH_HI[0], REACH_HI[1], viewer.y - heightAt(viewer.x, viewer.z)) : 0;
    // in 3D: Explore's camera climbs and dives, and the reach is measured from the camera
    if (this.last.distanceToSquared(viewer) > REFILL_M * REFILL_M) {
      this.last.copy(viewer);
      this.refill(viewer.x, viewer.y, viewer.z);
    }
    if (this.rFar === 0) return;
    this.farIn.value = Math.min(1, this.farIn.value + dt / 0.8);
    // the far tier: start a rebuild every FAR_REFILL_M m and step it within the budget (a job always finishes: flying
    // fast, the next one starts from where the camera is by then)
    if (this.farJob === null && this.farLast.distanceToSquared(viewer) > FAR_REFILL_M * FAR_REFILL_M) {
      this.farJobAt.copy(viewer);
      this.farJob = this.farRefill(viewer.x, viewer.y, viewer.z);
      this.stats.farJobMs = 0; this.stats.farJobFrames = 0;
    }
    if (this.farJob !== null) {
      const t0 = performance.now();
      this.stats.farJobFrames++;
      while (performance.now() - t0 < FAR_BUDGET_MS) if (this.farJob.next().done === true) { this.farJob = null; break; }
      this.stats.farJobMs += performance.now() - t0;
    }
  }

  /**
   * Grow in by distance (each plant at its own edge, E117), bend away from the player's legs, sway in the wind. `mode`:
   * MODE_NEAR shrinks away at the edge into the ground's colour; MODE_HANDOVER shrinks away keeping its colours (its far
   * model grows in on the same spot); MODE_FAR is that far model: in from the near edge, out at its own far edge, where
   * it takes on the ground's colour first.
   */
  private patch(mat: THREE.MeshStandardMaterial, reach: THREE.Vector3, far: THREE.Vector3, mode: number): void {
    const u = this.uniforms, uReach = { value: reach }, uBlend = blendUniform, uFarReach = { value: far }, uMode = { value: mode }, uFarIn = this.farIn;
    mat.onBeforeCompile = (sh) => {
      attachFogUniforms(sh);
      sh.uniforms['uPlayer'] = u.uPlayer; sh.uniforms['uTime'] = windUniforms.uWindTime; sh.uniforms['uWind'] = u.uWind; sh.uniforms['uReach'] = uReach; sh.uniforms['uBlend'] = uBlend;
      sh.uniforms['uFarReach'] = uFarReach; sh.uniforms['uMode'] = uMode; sh.uniforms['uFarIn'] = uFarIn;
      sh.uniforms['uReachUp'] = u.uReachUp; sh.uniforms['uCoverTint'] = coverTintUniform;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nuniform vec3 uPlayer; uniform float uTime; uniform float uWind; uniform vec3 uReach; uniform float uBlend; uniform vec3 uFarReach; uniform float uMode; uniform float uFarIn; uniform float uReachUp; uniform float uCoverTint;\nattribute vec3 aGround; attribute vec4 aCover; attribute vec4 aNrm; varying vec3 vGround; varying float vFar;${COVER_SEEN_GLSL}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 away = io.xz - uPlayer.xz;
          float dl = max(length(away), 1e-3);
          // this plant's edge in [near + grow, far], from its yaw (the refill's h = yaw / 2π)
          float h = fract(atan(-instanceMatrix[0].z, instanceMatrix[0].x) / 6.2831853 + 1.0);
          vec3 toC = cameraPosition - io;
          float dc = length(toC);
          // E156 C: plants on sloping ground keep their reach further out (GroundCover.ts reachMax — the same numbers)
          float facing = abs(dot(aNrm.xyz, toC / max(dc, 1e-3)));
          float rk = 1.0 + uReachUp * ${(REACH_UP - 1).toFixed(3)} * smoothstep(${SLOPE_LO.toFixed(3)}, ${SLOPE_HI.toFixed(3)}, 1.0 - aNrm.y);
          vec3 reach = uReach * rk, farReach = uFarReach * rk;
          float edge = mix(reach.x + reach.z, reach.y, h);
          float nearK = 1.0 - smoothstep(edge - reach.z, edge, dc);
          if (uMode > 1.5) {
            // the far model: grows in as the near one shrinks, keeps its colours, then at its own far edge (same h)
            // takes on the ground's colour and shrinks away
            float fEdge = mix(farReach.x + farReach.z, farReach.y, h);
            transformed *= (1.0 - nearK) * (1.0 - smoothstep(fEdge - farReach.z, fEdge, dc)) * uFarIn;
            vFar = smoothstep(fEdge - 2.5 * farReach.z, fEdge - farReach.z, dc) * uBlend;
          } else {
            transformed *= nearK;
            // past near it turns into the ground it stands on, all the way by the time it starts to shrink (unless its far
            // model takes over there)
            vFar = uMode > 0.5 ? 0.0 : smoothstep(reach.x, max(edge - reach.z, reach.x + 1.0), dc) * uBlend;
          }
          // E156 A: the ground it fades into wears the cover, as the terrain draws it from here (coverTint.ts)
          vGround = mix(aGround, aCover.rgb, coverSeen(aCover.a, aNrm.w, facing) * uCoverTint);
          float hgt = max(position.y, 0.0);
          vec2 push = (away / dl) * (1.0 - smoothstep(0.35, 1.5, dl)) * 1.1;
          float ph = io.x * 0.31 + io.z * 0.23;
          vec2 wind = vec2(sin(uTime * 1.7 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.7), 0.6 * cos(uTime * 1.3 + ph)) * (0.05 + 0.18 * uWind);
          vec2 off = (push + wind) * hgt;
          vec3 ax = instanceMatrix[0].xyz, az = instanceMatrix[2].xyz;
          float s2 = max(dot(ax, ax), 1e-4);
          transformed.x += dot(vec3(off.x, 0.0, off.y), ax) / s2;
          transformed.z += dot(vec3(off.x, 0.0, off.y), az) / s2;
          transformed.y -= length(off) * 0.4 * hgt;
        }
        #else
          vFar = 0.0; vGround = vec3(0.0);
        #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGround; varying float vFar;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGround, vFar);')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), vFar));');
    };
    mat.customProgramCacheKey = () => 'ground-cover';
  }
}

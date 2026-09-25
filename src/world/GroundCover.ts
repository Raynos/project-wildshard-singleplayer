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
 * the thinning band has no edge to see. `?coverblend=0` turns that off (the plants keep their colours to their edge).
 *
 * E117 follow-up (the user: "more distant cover") — the far tier. Tufts, ferns, hibiscus, bushes and daisies each get a
 * far model of 3–8 triangles (for tufts only 60 % of them, a little bigger) (the same silhouette at 25 m+, its flowers as flat colour chips). Past its near edge a
 * plant cross-fades into its far model (one shrinks as the other grows, same spot), which keeps the plant's colours out
 * to a second per-plant edge in [farNear, farFar] (phone: tufts 26–60 m, bushes 30–76 m), thins out plant by plant there
 * and only then takes on the ground's colour and shrinks. So the island stays dressed from Explore's height and far
 * out, with the same no-ring, no-pop rules. The far set is rebuilt every FAR_REFILL_M of travel by a job that runs a
 * slice of cells per frame (FAR_BUDGET_MS) into staging buffers and swaps them in when done, with FAR_SLACK m of room,
 * so neither the refill nor new cells hitch a frame. `?coverfar=off` is the near tier alone (the first E117 fix),
 * `?coverfar=far` reaches 1.5× further again.
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
import type { Sky } from './Sky';

export interface GroundCoverOpts {
  sea: number;
  /** the palms (Palms.scatterIsland): ferns, hibiscus and bushes crowd round their feet */
  palms?: { x: number; z: number }[];
}

const CELL = 16, REFILL_M = 4;
/** E117: the desktop's reach over the phone's (and its instance caps grow with the area) */
const REACH_K = TIER === 'desktop' ? 1.25 : 1, CAP_K = TIER === 'desktop' ? 3 : 1.8;
/** E117: far plants blend into the ground's colour and shade (1); `?coverblend=0` keeps their own to the edge (0) */
const BLEND = new URLSearchParams(location.search).get('coverblend') === '0' ? 0 : 1;
/** E117 follow-up: the far tier (`?coverfar=off|on|far`, default on) and how far it reaches over the phone numbers below */
const COVER_FAR = ((): 'off' | 'on' | 'far' => { const v = new URLSearchParams(location.search).get('coverfar'); return v === 'off' || v === 'far' ? v : 'on'; })();
const FAR_K = COVER_FAR === 'far' ? 1.5 : 1;
/** the far set is rebuilt every FAR_REFILL_M m, within FAR_BUDGET_MS a frame, with FAR_SLACK m of room either side */
const FAR_REFILL_M = 8, FAR_SLACK = 16, FAR_BUDGET_MS = TIER === 'desktop' ? 2 : 1.5;
/** shader modes: a near plant that just shrinks away / hands over to its far model; a far model */
const MODE_NEAR = 0, MODE_HANDOVER = 1, MODE_FAR = 2;
/** floats per cached candidate: x y z yaw scale · tint rgb · ground rgb */
const STRIDE = 11;
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
  stage: { mat: Float32Array; col: Float32Array | null; gnd: Float32Array; n: number };
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
  scale: [number, number];
  /** per-instance tint (multiplies the vertex colours) */
  tint?: (h: number, rng: Rng, out: THREE.Color) => void;
}

const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ── the far models' pieces (E117 follow-up): one or two triangles each ──
/** a grass blade leaning out along yaw `a`: base width 2w, height h, lean (0 up … 1 flat) */
function bladeTri(a: number, w: number, h: number, lean: number): THREE.BufferGeometry {
  const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
  return tris([ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + Math.cos(a) * h * lean, h, oz + Math.sin(a) * h * lean]);
}
/** a frond as one triangle: `w`× its length wide at a third of the way out, pitched up by `pitch`, turned to `yaw` */
function frondTri(yaw: number, len: number, w: number, pitch: number): THREE.BufferGeometry {
  const hw = (len * w) / 2;
  return tris([-hw, 0, len * 0.3, hw, 0, len * 0.3, 0, -0.3 * len, len]).rotateX(-pitch).rotateY(yaw);
}
/** a flat flower chip of radius r, tipped by `tilt` rad: one triangle */
function chip(r: number, tilt: number): THREE.BufferGeometry {
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; v.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  return tris(v).rotateX(-tilt);
}
/** a broad leaf as a diamond (two triangles) on a short rise: length `len`, width `w`, pitched up by `pitch` */
function leafDiamond(yaw: number, len: number, w: number, pitch: number, up: number): THREE.BufferGeometry {
  const m = len * 0.45;
  return tris([0, 0, 0, w / 2, 0, m, 0, 0, len, 0, 0, 0, 0, 0, len, -w / 2, 0, m]).rotateX(-pitch).rotateY(yaw).translate(0, up, 0);
}

export class GroundCover {
  group = new THREE.Group();
  private kinds: Kind[] = [];
  private cells = new Map<string, Float32Array[]>();
  private last = new THREE.Vector3(1e9, 0, 1e9);
  private uniforms = { uPlayer: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: coverWind };
  /** the furthest any plant shows + a refill's travel: the cell window's radius */
  private rMax = 0;
  private cacheMax = 96;
  private avoid: { x: number; z: number; r: number }[] = [];
  private tint = new THREE.Color();
  private ground = new THREE.Color();
  /** the far tier's rebuild: a job stepped within FAR_BUDGET_MS a frame; where the shown / the next set were built from */
  private farJob: Generator<undefined, undefined, undefined> | null = null;
  private farLast = new THREE.Vector3(1e9, 0, 1e9);
  private farJobAt = new THREE.Vector3();
  private rFar = 0;
  /** 0 → 1 over ~0.8 s when a far set lands somewhere new (boot, a teleport), so it grows in instead of appearing */
  private farIn = { value: 1 };
  /** measurements for scripts/popin-fly.mjs (group.userData.stats) */
  readonly stats = { nearRefillMs: 0, farJobMs: 0, farJobFrames: 0, farCells: 0, farCount: 0, cellsBuilt: 0 };

  constructor(private sky: Sky, private opts: GroundCoverOpts) {
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
    const fernGeo = geo(fern(rng, 0.75), 0x6c02);
    const hibGeo = geo((k) => {
      k.addParts(fern(rng, 0.42), { jitter: 0.08 });
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
      this.group.add(mesh);
      return mesh;
    };
    /** `farOf`: [far model, [farNear, farFar] m, cap, keep] — the far tier (none when `?coverfar=off`) */
    const kind = (name: string, g: THREE.BufferGeometry, cap0: number, [near, far]: [number, number], scale: [number, number], density: Kind['density'], tint?: Kind['tint'], farOf?: [THREE.BufferGeometry, [number, number], number, number]): void => {
      const cap = Math.round(cap0 * CAP_K);
      const reach = new THREE.Vector3(near * REACH_K, far * REACH_K, (far - near) * REACH_K * 0.25);
      this.rMax = Math.max(this.rMax, reach.y + REFILL_M + EYE_SLACK);
      let farTier: FarTier | null = null;
      const farReach = new THREE.Vector3(0, 0, 1);
      if (farOf && COVER_FAR !== 'off') {
        const [fg, [fn, ff], fcap0, keep] = farOf, k = REACH_K * FAR_K, fcap = Math.round(fcap0 * keep * CAP_K * FAR_K * FAR_K);
        farReach.set(fn * k, ff * k, (ff - fn) * k * 0.25);
        this.rFar = Math.max(this.rFar, farReach.y + FAR_SLACK + EYE_SLACK);
        farTier = {
          mesh: instanced(`ground-cover-${name}-far`, fg, material(reach, farReach, MODE_FAR), fcap, tint !== undefined), cap: fcap, reach: farReach, keep,
          stage: { mat: new Float32Array(fcap * 16), col: tint ? new Float32Array(fcap * 3) : null, gnd: new Float32Array(fcap * 3), n: 0 },
        };
      }
      const mesh = instanced(`ground-cover-${name}`, g, material(reach, farReach, farTier ? MODE_HANDOVER : MODE_NEAR), cap, tint !== undefined);
      this.kinds.push({ name, mesh, cap, far: farTier, reach, density, scale, ...(tint ? { tint } : {}) });
    };
    // the far models: a few triangles each, the near model's silhouette from 25 m on (its flowers as flat chips)
    const farRng = new Rng(SEED ^ 0x6cf0);
    const farTuftGeo = geo((k) => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + farRng.range(-0.4, 0.4); k.add(bladeTri(a, 0.08, farRng.range(0.32, 0.46), farRng.range(0.2, 0.45)), [PLANT.grassTip, PLANT.grass, PLANT.grassB][i] ?? PLANT.grass); } }, 0x6cf1);
    const farFernGeo = geo((k) => { for (let i = 0; i < 6; i++) k.add(frondTri((i / 6) * Math.PI * 2 + farRng.range(-0.25, 0.25), 0.75 * farRng.range(0.75, 1.1), 0.2, farRng.range(0.45, 0.85)), i % 3 === 0 ? PLANT.leafLight : i % 2 ? PLANT.leaf : PLANT.leafB); }, 0x6cf2);
    const farHibGeo = geo((k) => {
      for (let i = 0; i < 4; i++) k.add(frondTri((i / 4) * Math.PI * 2 + farRng.range(-0.25, 0.25), 0.42 * farRng.range(0.75, 1.1), 0.2, farRng.range(0.45, 0.85)), i % 2 ? PLANT.leaf : PLANT.leafB);
      for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.add(chip(0.1, 0.5).translate(x, y, z), PLANT.hibiscus);
    }, 0x6cf3);
    const farDaisyGeo = geo((k) => {
      for (let i = 0; i < 2; i++) k.add(bladeTri(i * Math.PI, 0.03, 0.18, 0.3), PLANT.grass);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, d = farRng.range(0.08, 0.2); k.add(chip(0.065, 0).translate(Math.cos(a) * d, farRng.range(0.14, 0.26), Math.sin(a) * d), i % 2 ? '#f6f2e6' : '#fbe9a0'); }
    }, 0x6cf4);
    const farBushGeo = geo((k) => { for (let i = 0; i < 4; i++) { const len = farRng.range(0.65, 0.95); k.add(leafDiamond((i / 4) * Math.PI * 2 + farRng.range(-0.3, 0.3), len, len * 0.62, farRng.range(0.35, 0.8), farRng.range(0.15, 0.45)), i % 2 ? PLANT.leafDark : PLANT.leaf); } }, 0x6cf5);
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
    const bushGeo = geo(openEnded(broadClump(rng, 1.0)), 0x6c07);
    kind('bush', bushGeo, 900, [16, 38], [0.8, 1.6], (h, sl, td, sd, palm) => (this.edge(h, sl) * 0.3 + palm * 0.3 + grass(h, sl) * 0.015) * off(td) + jungle(sd) * grass(h, sl) * 0.06, undefined, [farBushGeo, [30, 76], 4000, 1]);
    const span = Math.ceil((2 * Math.max(this.rMax, this.rFar)) / CELL) + 1;
    this.cacheMax = Math.max(96, Math.round(span * span * 1.4));
    this.group.userData['stats'] = this.stats;
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
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
    // one candidate set per cell (≈ 2 per m²), the terrain read once per point, then a density lottery per kind
    const n = 520;
    for (let i = 0; i < n; i++) {
      const x = (cx + rng.next()) * CELL, z = (cz + rng.next()) * CELL;
      if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) continue;
      const y = heightAt(x, z), h = y - sea;
      if (h < 0.4) continue;
      const [, ny] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) continue;
      const td = trailDistance(x, z), sd = Math.hypot(x - SHRINE.x, z - SHRINE.z), palm = this.nearPalm(x, z);
      this.kinds.forEach((k, ki) => {
        const d = k.density(h, slope, td, sd, palm);
        if (rng.next() * 2 > d) return;
        const jx = x + rng.range(-0.3, 0.3), jz = z + rng.range(-0.3, 0.3), sc = rng.range(k.scale[0], k.scale[1]);
        if (k.tint) k.tint(h, rng, this.tint); else this.tint.setRGB(1, 1, 1);
        const jy = heightAt(jx, jz), yaw = rng.range(0, Math.PI * 2);
        lowPolyGroundColor(this.ground, jy - sea, slope, jx, jz);
        vals[ki]?.push(jx, jy - 0.02, jz, yaw, sc, this.tint.r, this.tint.g, this.tint.b, this.ground.r, this.ground.g, this.ground.b);
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
    const TAU = Math.PI * 2;
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const v = data[ki];
        if (v === undefined) return;
        const near = k.reach.x, far = k.reach.y, grow = k.reach.z, slack = REFILL_M + EYE_SLACK;
        const mat = k.mesh.instanceMatrix.array as Float32Array, col = k.mesh.instanceColor ? (k.mesh.instanceColor.array as Float32Array) : null;
        const gnd = k.mesh.geometry.getAttribute('aGround').array as Float32Array;
        let n = counts[ki] ?? 0;
        for (let i = 0; i < v.length && n < k.cap; i += STRIDE) {
          const x = v[i] ?? 0, y = v[i + 1] ?? 0, z = v[i + 2] ?? 0, yaw = v[i + 3] ?? 0;
          // this plant's edge (the shader's): yaw / 2π; round the wrap (the GPU's atan may land either side) to the far end
          const h = yaw / TAU, edge = h < 0.005 || h > 0.995 ? far : near + grow + (far - near - grow) * h, lim = edge + slack;
          if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 > lim * lim) continue;
          const s = v[i + 4] ?? 1, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16;
          // a turn about +y, scaled: what Matrix4.compose writes, without the quaternion
          mat[o] = c; mat[o + 1] = 0; mat[o + 2] = -sn; mat[o + 3] = 0;
          mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0;
          mat[o + 8] = sn; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
          mat[o + 12] = x; mat[o + 13] = y; mat[o + 14] = z; mat[o + 15] = 1;
          if (col) { col[n * 3] = v[i + 5] ?? 1; col[n * 3 + 1] = v[i + 6] ?? 1; col[n * 3 + 2] = v[i + 7] ?? 1; }
          gnd[n * 3] = v[i + 8] ?? 0; gnd[n * 3 + 1] = v[i + 9] ?? 0; gnd[n * 3 + 2] = v[i + 10] ?? 0;
          n++;
        }
        counts[ki] = n;
      });
    }
    this.kinds.forEach((k, ki) => {
      k.mesh.count = counts[ki] ?? 0;
      k.mesh.instanceMatrix.needsUpdate = true;
      if (k.mesh.instanceColor) k.mesh.instanceColor.needsUpdate = true;
      k.mesh.geometry.getAttribute('aGround').needsUpdate = true;
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
    const TAU = Math.PI * 2, slack = FAR_SLACK + EYE_SLACK;
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
          const edge = wrap ? near + grow : near + grow + (far - near - grow) * h, fEdge = wrap ? fFar : fNear + fGrow + (fFar - fNear - fGrow) * h;
          const d2 = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2, lo = Math.max(0, edge - grow - slack), hi = fEdge + slack;
          if (d2 > hi * hi || d2 < lo * lo) continue;
          const s = (v[i + 4] ?? 1) * growK, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16, m = st.mat;
          m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
          m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
          m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
          m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
          if (st.col) { st.col[n * 3] = v[i + 5] ?? 1; st.col[n * 3 + 1] = v[i + 6] ?? 1; st.col[n * 3 + 2] = v[i + 7] ?? 1; }
          st.gnd[n * 3] = v[i + 8] ?? 0; st.gnd[n * 3 + 1] = v[i + 9] ?? 0; st.gnd[n * 3 + 2] = v[i + 10] ?? 0;
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
      const gnd = mesh.geometry.getAttribute('aGround');
      if (gnd instanceof THREE.BufferAttribute) copy(gnd, st.gnd, 3);
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
    const u = this.uniforms, uReach = { value: reach }, uBlend = { value: BLEND }, uFarReach = { value: far }, uMode = { value: mode }, uFarIn = this.farIn;
    mat.onBeforeCompile = (sh) => {
      attachFogUniforms(sh);
      sh.uniforms['uPlayer'] = u.uPlayer; sh.uniforms['uTime'] = windUniforms.uWindTime; sh.uniforms['uWind'] = u.uWind; sh.uniforms['uReach'] = uReach; sh.uniforms['uBlend'] = uBlend;
      sh.uniforms['uFarReach'] = uFarReach; sh.uniforms['uMode'] = uMode; sh.uniforms['uFarIn'] = uFarIn;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uPlayer; uniform float uTime; uniform float uWind; uniform vec3 uReach; uniform float uBlend; uniform vec3 uFarReach; uniform float uMode; uniform float uFarIn;\nattribute vec3 aGround; varying vec3 vGround; varying float vFar;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 away = io.xz - uPlayer.xz;
          float dl = max(length(away), 1e-3);
          // this plant's edge in [near + grow, far], from its yaw (the refill's h = yaw / 2π)
          float h = fract(atan(-instanceMatrix[0].z, instanceMatrix[0].x) / 6.2831853 + 1.0);
          float edge = mix(uReach.x + uReach.z, uReach.y, h);
          float dc = distance(io, cameraPosition);
          float nearK = 1.0 - smoothstep(edge - uReach.z, edge, dc);
          if (uMode > 1.5) {
            // the far model: grows in as the near one shrinks, keeps its colours, then at its own far edge (same h)
            // takes on the ground's colour and shrinks away
            float fEdge = mix(uFarReach.x + uFarReach.z, uFarReach.y, h);
            transformed *= (1.0 - nearK) * (1.0 - smoothstep(fEdge - uFarReach.z, fEdge, dc)) * uFarIn;
            vFar = smoothstep(fEdge - 2.5 * uFarReach.z, fEdge - uFarReach.z, dc) * uBlend;
          } else {
            transformed *= nearK;
            // past near it turns into the ground it stands on, all the way by the time it starts to shrink (unless its far
            // model takes over there)
            vFar = uMode > 0.5 ? 0.0 : smoothstep(uReach.x, max(edge - uReach.z, uReach.x + 1.0), dc) * uBlend;
          }
          vGround = aGround;
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

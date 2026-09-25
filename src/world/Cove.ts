/**
 * Cove — Wreck Cove's dressing (Driftwood Isle, remaster M2): the SEA CAVE, tidepools, the cascade.
 *
 * The sea cave sits in the low notch at the crag foot north-west of the wreck: a vault of faceted boulders (grass and
 * moss on the outer tops, wet dark rock inside, stalactites) over a level rock-slab floor you walk on, vines hanging over
 * the mouth, a torch beside it. Inside: an antechamber with a tide pool, a narrow passage (the adventure's sluice gate
 * fits it: 2.5 m wide), then a raised alcove lit by glowing cyan crystals. Crystal and torch light are baked into the
 * vertex colours (no runtime light); the flames / crystals are one unlit draw. Tidepools among rock rims on the cove flats
 * (a ripple shader, the reef crabs' homes) and the cascade (the look-agent's Waterfall curtain, W5) over the crag into its plunge pool.
 *
 * Draws: rocks + cave (one LowPolyKit mesh on lowPolyMaterial), glow, pools, cascade.
 *
 *   const cove = new Cove(sky).build(Cove.forIsland());
 *   scene.add(cove.group); player.colliders.push(...cove.colliders);
 *   player.platforms.push((x, z) => cove.floorHeightAt(x, z));      // the cave floor (antechamber, ramp, alcove)
 *   game.onUpdate((dt) => cove.update(dt));
 *   enemies: new Enemies(animals, { crabSites: cove.crabSites, … })   // the tidepool groups the Reef Crabs live at
 *
 * Cave frame: `spec.cave` {x, z} is the middle of the MOUTH, the interior runs along local +z, world = origin +
 * R_y(yaw) · local (the adventure's POI frame convention). `anchors` (world coords, y = floor, yaw = world facing,
 * 0 = +Z): caveFloor (the antechamber), plateA / plateB (on the sand in front of the mouth), barrelStart (the beach by
 * the wreck's bow), gate (the passage — faces the mouth), alcove (the crystal alcove behind the gate).
 * `caveBounds` {x, z, r, yMin, yMax} (the cave reverb) — also on `Cove.forIsland()` for the ambience.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { Waterfall } from './Waterfall';
import { SEED } from '../core/config';
import { LowPolyKit, rock, log, tris, bakeLight, lowPolyMaterial, type BakedLight } from './lowpolyKit';
import { Rng } from '../core/rng';
import { rockLook, rockGeometry, rockIsSmooth, rockMaterial, REEF_ROCK } from './rockKit';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import { boxDesc, type ColliderDesc } from './registry';

export interface CaveBounds { x: number; z: number; r: number; yMin: number; yMax: number }
export interface CoveAnchor { x: number; y: number; z: number; yaw: number }
export interface CoveSpec {
  pools: { x: number; z: number; r: number }[];
  /** where the crab groups sit (a pool each) */
  crabSites: { x: number; z: number }[];
  /** the cascade: top and foot of the fall (world), width */
  fall: { top: [number, number]; foot: [number, number]; width: number };
  /** the sea cave: the middle of the mouth, the yaw of the interior (local +z), width / height of the antechamber, depth to the back wall */
  cave: { x: number; z: number; yaw: number; w: number; h: number; depth: number };
  caveBounds: CaveBounds;
}

const C = {
  rock: '#50555d', rockB: '#474c54', rockDark: '#383c43', rockWet: '#46535a', rockIn: '#5a544d', rockInB: '#655e56',
  grass: '#6fa23e', grassB: '#86b84a', moss: '#5f8a3a', vine: '#4f8a32', vineB: '#6aa640', sand: '#b9a67c', slab: '#7a756c', slabB: '#8a847a',
  star: '#e8622a', starPurple: '#6b3fa0', crystal: '#7ff0ff', crystalB: '#5fd0ff', flame: '#ffc46a', torch: '#5a4230', stala: '#555860',
};

// cave layout (local metres, lz = 0 at the mouth)
const ANTE = { z1: 5.2, hw: 2.8, ceil: 3.8 };
const PASS = { z0: 5.2, z1: 6.4, hw: 1.25, ceil: 2.9 };
const ALC = { z0: 6.4, hw: 2.0, ceil: 3.4 };
const RAMP = { z0: 5.8, z1: 6.8 };
/** PHYSICS P4: the ramp's collision treads (see `colliderDescs`): 4 × 0.375 m, centred on the drawn ramp's middle, 5 cm clear of the sluice leaf */
const STEPS = { z0: 5.65, z1: 7.15 };
const FLOOR = 1.2, ALC_FLOOR = 2.2;
/**
 * PHYSICS P4: the baked terrain rises through the cave floor from lz ≈ 5 and stands over the alcove floor from lz ≈ 7,
 * so the physics heightfield is pushed under the cave inside this rectangle (local, from the mouth). It starts 1 m in
 * (the grid row at the mouth keeps its height: the beach walks straight onto the floor slab) and ends past the back
 * wall; ±4.2 m takes every grid column whose triangles reach the floor. `BACKFILL` walls off the triangles that climb
 * back out of the cut behind the back wall (one grid cell, ~2 m, past its far edge).
 */
const CUT = { hw: 4.2, z0: 1.0, z1: 10.2, below: FLOOR - 0.6 };
const BACKFILL = { hw: CUT.hw + 2.0, z1: CUT.z1 + 2.0 };

export class Cove {
  group = new THREE.Group();
  colliders: Collider[] = [];
  crabSites: { x: number; z: number }[] = [];
  anchors: Record<string, CoveAnchor> = {};
  caveBounds: CaveBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };
  private uniforms = { uTime: { value: 0 } };
  private t = 0;
  private fall: Waterfall | null = null;
  private cave: CoveSpec['cave'] = { x: 0, z: 0, yaw: 0, w: 0, h: 0, depth: 0 };

  constructor(private sky: Sky) {}

  /** the island layout: pools on the cove flats, the cascade down the crag, the sea cave in the notch at the crag foot */
  static forIsland(): CoveSpec {
    const cave = { x: 142, z: 14.5, yaw: 0, w: ANTE.hw * 2, h: ANTE.ceil, depth: 8.8 };
    const mid = cave.depth * 0.5;
    return {
      pools: [
        { x: 130, z: 4, r: 2.3 }, { x: 134.5, z: 8.5, r: 1.5 }, { x: 126.5, z: 7, r: 1.2 },
        { x: 133, z: -8, r: 2.1 }, { x: 128, z: -13, r: 1.4 }, { x: 137.5, z: -3.5, r: 1.1 },
      ],
      crabSites: [{ x: 130, z: 5 }, { x: 132, z: -9 }],
      fall: { top: [120.5, 24.5], foot: [127.5, 18], width: 1.7 },
      cave,
      caveBounds: { x: cave.x + Math.sin(cave.yaw) * mid, z: cave.z + Math.cos(cave.yaw) * mid, r: 5.2, yMin: FLOOR - 0.4, yMax: FLOOR + 4.5 },
    };
  }

  /** cave-local (lx, lz) → world (x, z) */
  private W(lx: number, lz: number): [number, number] {
    const c = this.cave, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    return [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs];
  }
  private L(x: number, z: number): [number, number] {
    const c = this.cave, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = x - c.x, dz = z - c.z;
    return [dx * cs - dz * sn, dx * sn + dz * cs];
  }
  /** the cave's floor under local lz (the antechamber, the ramp through the passage, the raised alcove) */
  private floorAt(lz: number): number {
    if (lz < RAMP.z0) return FLOOR;
    if (lz > RAMP.z1) return ALC_FLOOR;
    return FLOOR + ((lz - RAMP.z0) / (RAMP.z1 - RAMP.z0)) * (ALC_FLOOR - FLOOR);
  }
  private halfWidth(lz: number): number { return lz < PASS.z0 ? ANTE.hw : lz < PASS.z1 ? PASS.hw : ALC.hw; }
  private ceil(lz: number): number { return lz < PASS.z0 ? ANTE.ceil : lz < PASS.z1 ? PASS.ceil : ALC.ceil; }

  build(spec: CoveSpec): this {
    this.crabSites = spec.crabSites;
    this.cave = spec.cave;
    this.caveBounds = spec.caveBounds;
    const kit = new LowPolyKit(SEED ^ 0xc0e5), rng = kit.rng;
    const glow = new LowPolyKit(SEED ^ 0xc0e6);
    const lights: BakedLight[] = [];
    const cave = spec.cave;
    const m4 = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1): THREE.Matrix4 =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
    const boulder = (x: number, y: number, z: number, r: number, side: string, top: string, squash = 0.8, rough = 0.28): void =>
      kit.addTopped(rock(r, 1, rng, squash, rough), side, top, { matrix: m4(x, y, z, rng.range(0, 6.28)), minY: 0.6, jitter: 0.08 });
    // E114: the loose outdoor rocks (tidepool rims, the plunge pool) in rockKit's look (B by default, ?rocks=now the old); the
    // crag and the cave walls stay as they are (they are structure). The draws `boulder` would take are burnt, so
    // everything after is placed as today.
    const look = rockLook(), lookRng = new Rng(SEED ^ 0x70c7), smoothRocks: THREE.BufferGeometry[] = [];
    const looseRock = (x: number, y: number, z: number, r: number, side: string, top: string, squash = 0.8): void => {
      if (look === 'current') { boulder(x, y, z, r, side, top, squash); return; }
      const g = rock(r, 1, rng, squash, 0.28), m = m4(x, y, z, rng.range(0, 6.28));
      for (let i = g.getAttribute('position').count / 3; i > 0; i--) rng.next();
      g.dispose();
      const alt = rockGeometry(look, r, lookRng, { squash, palette: REEF_ROCK, moss: top === C.moss ? 0.8 : 0.3, ground: -0.2 * r });
      if (rockIsSmooth(look)) { alt.applyMatrix4(m); smoothRocks.push(alt); } else kit.addPainted(alt, m);
    };
    const starfish = (x: number, y: number, z: number, r: number, col: string): void => {
      const v: number[] = [], rot = rng.range(0, 6.28);
      for (let k = 0; k < 5; k++) {
        const a0 = rot + (k / 5) * Math.PI * 2, tipX = x + Math.cos(a0) * r, tipZ = z + Math.sin(a0) * r;
        const lx = x + Math.cos(a0 + Math.PI / 5) * r * 0.35, lz = z + Math.sin(a0 + Math.PI / 5) * r * 0.35, rx = x + Math.cos(a0 - Math.PI / 5) * r * 0.35, rz = z + Math.sin(a0 - Math.PI / 5) * r * 0.35;
        v.push(x, y + r * 0.22, z, rx, y + 0.01, rz, tipX, y + 0.01, tipZ, x, y + r * 0.22, z, tipX, y + 0.01, tipZ, lx, y + 0.01, lz);
      }
      kit.add(tris(v), col, { jitter: 0.08 });
    };

    // ── tidepools: a rim of dark rocks, the water disc a hand under the sand line, starfish on the rim ──
    const poolParts: THREE.BufferGeometry[] = [];
    for (const p of spec.pools) {
      const gy = heightAt(p.x, p.z), nR = Math.round(p.r * 3.2);
      for (let i = 0; i < nR; i++) {
        const a = (i / nR) * Math.PI * 2 + rng.range(-0.2, 0.2), rr = p.r + rng.range(-0.1, 0.35);
        const rx = p.x + Math.cos(a) * rr, rz = p.z + Math.sin(a) * rr, r = rng.range(0.22, 0.5);
        looseRock(rx, heightAt(rx, rz) + r * 0.2, rz, r, rng.next() < 0.3 ? C.rockWet : C.rock, rng.next() < 0.4 ? C.moss : C.rockB, 0.65);
        if (rng.next() < 0.28) starfish(rx + rng.range(-0.2, 0.2), heightAt(rx, rz) + 0.16, rz + rng.range(-0.2, 0.2), rng.range(0.12, 0.2), rng.next() < 0.7 ? C.star : C.starPurple);
      }
      const disc = new THREE.CircleGeometry(p.r + 0.05, 10);
      disc.rotateX(-Math.PI / 2); disc.translate(p.x, gy + 0.03, p.z);
      poolParts.push(disc);
      if (rng.next() < 0.7) starfish(p.x + rng.range(-0.4, 0.4), gy - 0.02, p.z + rng.range(-0.4, 0.4), rng.range(0.14, 0.22), C.star);
    }

    // ── the cascade: a ribbon of quads hugging the crag face, foam bands scroll down it; a plunge pool at the foot ──
    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot;
      const w = spec.fall.width;
      const dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz), sx = -dz / len, sz = dx / len;
      for (let i = 0; i < 9; i++) {
        const u = rng.range(0.05, 0.95), side = i % 2 ? 1 : -1, r = rng.range(0.35, 0.8);
        const x = tx + dx * u + sx * side * (w * 0.7 + rng.range(0, 0.5)), z = tz + dz * u + sz * side * (w * 0.7 + rng.range(0, 0.5));
        looseRock(x, heightAt(x, z) + r * 0.25, z, r, C.rockWet, C.moss, 0.7);
      }
      const px = fx + (dx / len) * 1.2, pz = fz + (dz / len) * 1.2, py = heightAt(fx, fz);
      const disc = new THREE.CircleGeometry(2.4, 12); disc.rotateX(-Math.PI / 2); disc.translate(px, py + 0.05, pz);
      poolParts.push(disc);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rng.range(-0.2, 0.2), x = px + Math.cos(a) * 2.6, z = pz + Math.sin(a) * 2.6, r = rng.range(0.3, 0.6);
        looseRock(x, heightAt(x, z) + r * 0.25, z, r, C.rockWet, C.moss, 0.7);
      }
    }

    // ── the sea cave ──
    const W = (lx: number, lz: number) => this.W(lx, lz);
    const at = (lx: number, y: number, lz: number): THREE.Vector3 => { const [x, z] = W(lx, lz); return new THREE.Vector3(x, y, z); };
    // walls: two courses of boulders down each side, their inner faces on the half-width line
    for (let lz = -0.2; lz < cave.depth + 0.4; lz += 1.05) {
      const hw = this.halfWidth(lz), fl = this.floorAt(lz), ce = this.ceil(lz);
      for (const side of [-1, 1]) {
        for (const [dy, rr] of [[0.35, rng.range(0.95, 1.25)], [1.7, rng.range(0.9, 1.2)], [ce - 0.2, rng.range(0.9, 1.15)]] as const) {
          const p = at(side * (hw + rr * 0.72), fl + dy, lz + rng.range(-0.2, 0.2));
          boulder(p.x, p.y, p.z, rr, rng.next() < 0.5 ? C.rockIn : C.rockInB, C.rockWet, 0.9, 0.22);
        }
      }
      // the roof: a row of boulders across, a little arch to it
      for (let lx = -hw + 0.5; lx <= hw - 0.3; lx += 1.2) {
        const rr = rng.range(0.9, 1.25), arch = 0.35 * (1 - (lx / hw) ** 2);
        const p = at(lx, fl + ce + rr * 0.55 + arch, lz + rng.range(-0.2, 0.2));
        boulder(p.x, p.y, p.z, rr, C.rockIn, C.rockInB, 0.75, 0.22);
      }
    }
    // the back wall of the alcove + a big rock burying the rising ground in its corner
    for (const lx of [-1.4, 0, 1.4]) { const p = at(lx, ALC_FLOOR + 1.0, cave.depth + 0.9); boulder(p.x, p.y, p.z, 1.3, C.rockIn, C.rockWet, 0.95, 0.2); }
    { const p = at(-1.9, ALC_FLOOR + 0.2, cave.depth - 0.4); boulder(p.x, p.y, p.z, 1.0, C.rockInB, C.rockWet, 0.8); }
    // the passage's shoulders: the wall steps in from the antechamber to the 2.5 m throat
    for (const side of [-1, 1]) for (const lz of [PASS.z0 - 0.15, PASS.z1 + 0.1]) {
      const p = at(side * (PASS.hw + 1.0), FLOOR + 1.3, lz); boulder(p.x, p.y, p.z, 1.2, C.rockInB, C.rockWet, 1.0, 0.18);
    }
    // the outer mass: big grass-topped boulders heaped over and around the vault so it reads as the crag's foot
    const mass: [number, number, number, number][] = [
      [-5.2, 1.2, 0.8, 2.6], [5.2, 1.4, 0.8, 2.6], [-5.5, 2.4, 4.0, 2.8], [5.4, 2.4, 4.2, 2.9], [-4.5, 3.0, 7.6, 2.6], [4.6, 3.2, 7.8, 2.5],
      [-2.4, 5.4, 1.8, 2.5], [2.3, 5.5, 2.0, 2.6], [0, 5.9, 4.6, 2.9], [-2.6, 5.6, 7.2, 2.7], [2.4, 5.8, 7.4, 2.6], [0, 6.2, 9.8, 2.8],
      [-3.8, 4.4, -0.6, 1.6], [3.9, 4.2, -0.5, 1.7], [-6.8, 0.6, -1.2, 1.5], [6.9, 0.8, -1.0, 1.6],
    ];
    for (const [lx, dy, lz, r] of mass) { const p = at(lx, FLOOR + dy, lz); boulder(p.x, p.y, p.z, r, rng.next() < 0.5 ? C.rock : C.rockB, rng.next() < 0.5 ? C.grass : C.grassB, 0.8, 0.25); }
    // the mouth arch: wet rocks low, a lintel of three over the opening
    for (const [lx, dy, r] of [[-2.9, 0.5, 0.9], [2.9, 0.4, 0.95], [-2.7, 2.0, 0.85], [2.8, 2.1, 0.85], [-1.6, 3.7, 0.9], [0, 4.0, 0.95], [1.6, 3.7, 0.9]] as const) {
      const p = at(lx, FLOOR + dy, -0.3); boulder(p.x, p.y, p.z, r, dy < 1 ? C.rockWet : C.rock, C.moss, 0.85, 0.2);
    }
    // the floor: rock slabs over a sand bed, the ramp up to the alcove, a tide pool in the antechamber
    {
      const sandV: number[] = [];
      const quad = (lx0: number, lz0: number, lx1: number, lz1: number) => {
        const a = at(lx0, this.floorAt(lz0) - 0.03, lz0), b = at(lx1, this.floorAt(lz0) - 0.03, lz0), c = at(lx1, this.floorAt(lz1) - 0.03, lz1), d = at(lx0, this.floorAt(lz1) - 0.03, lz1);
        sandV.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
      };
      for (let lz = -0.8; lz < cave.depth; lz += 0.5) { const hw = this.halfWidth(lz + 0.25) + 0.3; quad(-hw, lz, hw, lz + 0.5); }
      kit.add(tris(sandV), C.sand, { jitter: 0.06 });
      for (let i = 0; i < 26; i++) {
        const lz = rng.range(-0.3, cave.depth - 0.4), hw = this.halfWidth(lz) - 0.2, lx = rng.range(-hw, hw), r = rng.range(0.45, 0.85);
        if (Math.hypot(lx + 1.3, lz - 2.2) < 1.2) continue;                                  // the tide pool
        const p = at(lx, this.floorAt(lz) - 0.07, lz);
        kit.add(new THREE.CylinderGeometry(r, r * 1.05, 0.14, rng.int(5, 7)), rng.next() < 0.5 ? C.slab : C.slabB, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)), wobble: 0.03, jitter: 0.07 });
      }
      for (let k = 0; k < 4; k++) {                                                            // steps up the ramp
        const lz = RAMP.z0 + (k + 0.5) * (RAMP.z1 - RAMP.z0) / 4, p = at(0, this.floorAt(lz) - 0.08, lz);
        kit.add(new THREE.BoxGeometry(PASS.hw * 1.7, 0.18, 0.32), C.slabB, { matrix: m4(p.x, p.y, p.z, cave.yaw + rng.range(-0.05, 0.05)), wobble: 0.02 });
      }
      const pp = at(-1.3, FLOOR + 0.005, 2.2);
      const disc = new THREE.CircleGeometry(0.95, 9); disc.rotateX(-Math.PI / 2); disc.translate(pp.x, pp.y, pp.z);
      poolParts.push(disc);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, q = at(-1.3 + Math.cos(a) * 1.05, FLOOR, 2.2 + Math.sin(a) * 1.05); boulder(q.x, q.y + 0.05, q.z, rng.range(0.18, 0.3), C.rockWet, C.moss, 0.6); }
      starfish(pp.x + 0.3, FLOOR - 0.02, pp.z - 0.2, 0.16, C.starPurple);
    }
    // stalactites from the roof, a few stalagmites
    for (let i = 0; i < 16; i++) {
      const lz = rng.range(0.4, cave.depth - 0.3), hw = this.halfWidth(lz) - 0.35, lx = rng.range(-hw, hw), len = rng.range(0.35, 1.1), r = rng.range(0.07, 0.18);
      const p = at(lx, this.floorAt(lz) + this.ceil(lz) + 0.2, lz);
      kit.add(new THREE.ConeGeometry(r, len, 5).rotateX(Math.PI).translate(0, -len / 2, 0), C.stala, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)), jitter: 0.08 });
    }
    for (const [lx, lz, h] of [[2.2, 4.4, 0.7], [-2.3, 0.9, 0.5], [1.6, 8.3, 0.6]] as const) {
      const p = at(lx, this.floorAt(lz), lz); kit.add(new THREE.ConeGeometry(0.18, h, 5).translate(0, h / 2, 0), C.stala, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)) });
    }
    // vines hanging over the mouth and down the outer face
    for (let i = 0; i < 24; i++) {
      const lx = rng.range(-3.6, 3.6), lz = rng.range(-0.9, -0.4), top = FLOOR + 3.9 + rng.range(0, 0.9) - Math.abs(lx) * 0.25, len = rng.range(0.8, 2.6), w = rng.range(0.07, 0.13);
      const a = at(lx, top, lz), b = at(lx + rng.range(-0.15, 0.15), top - len, lz - rng.range(0.0, 0.2));
      const [ox, oz] = [Math.cos(cave.yaw) * w, -Math.sin(cave.yaw) * w];
      kit.add(tris([a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz, b.x, b.y, b.z]), rng.next() < 0.5 ? C.vine : C.vineB, { jitter: 0.1 });
      if (rng.next() < 0.6) for (let k = 1; k < 4; k++) {                                   // leaves along the strand
        const q = a.clone().lerp(b, k / 4), s = 0.12;
        kit.add(tris([q.x, q.y, q.z, q.x + ox * 2.2, q.y - s, q.z + oz * 2.2 - s * 0.5, q.x - ox * 0.4, q.y - s * 1.6, q.z - oz * 0.4]), C.vineB, { jitter: 0.1 });
      }
    }
    // the torch by the mouth: a lashed pole, a pitch head, the flame (glow) and its light baked on the rocks
    {
      const p = at(3.1, heightAt(...W(3.1, -1.1)), -1.1);
      kit.add(log(p, p.clone().add(new THREE.Vector3(0.05, 1.9, 0)), 0.06, 0.05, 5), C.torch);
      kit.add(new THREE.CylinderGeometry(0.1, 0.07, 0.25, 6).translate(p.x + 0.05, p.y + 1.95, p.z), '#2c241e');
      glow.add(new THREE.OctahedronGeometry(0.13, 0).scale(1, 1.9, 1).translate(p.x + 0.05, p.y + 2.25, p.z), C.flame, { jitter: 0 });
      glow.add(new THREE.OctahedronGeometry(0.17, 0).scale(1, 1.3, 1).translate(p.x + 0.05, p.y + 2.15, p.z), '#ff8a2a', { jitter: 0 });
      lights.push({ x: p.x, y: p.y + 2.2, z: p.z, color: '#ffae55', range: 5.5, intensity: 1.2 });
    }
    // a wall torch in the antechamber (its warm light is what you see from the beach), on an iron bracket
    {
      const p = at(ANTE.hw - 0.25, FLOOR + 1.7, 3.0);
      kit.add(new THREE.BoxGeometry(0.06, 0.06, 0.4).translate(0, 0, 0), '#3a3c42', { matrix: m4(p.x, p.y - 0.1, p.z, cave.yaw + Math.PI / 2) });
      kit.add(log(p.clone().add(new THREE.Vector3(0, -0.35, 0)), p.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.05, 0.045, 5), C.torch);
      glow.add(new THREE.OctahedronGeometry(0.11, 0).scale(1, 1.9, 1).translate(p.x, p.y + 0.45, p.z), C.flame, { jitter: 0 });
      glow.add(new THREE.OctahedronGeometry(0.15, 0).scale(1, 1.3, 1).translate(p.x, p.y + 0.36, p.z), '#ff8a2a', { jitter: 0 });
      lights.push({ x: p.x - 0.4, y: p.y + 0.4, z: p.z, color: '#ffa850', range: 7.5, intensity: 1.4 });
    }
    // glowing crystal clusters in the alcove (and one at the passage, so the way in reads from the mouth)
    const crystals: [number, number, number][] = [[-1.5, 8.2, 1], [1.5, 8.0, 1], [0.3, 8.6, 1.2], [-1.1, 6.9, 0.7], [1.9, 5.0, 0.6], [-2.4, 3.6, 0.5]];
    for (const [lx, lz, s] of crystals) {
      const p = at(lx, this.floorAt(lz), lz);
      for (let k = 0; k < 5; k++) {
        const h = rng.range(0.25, 0.7) * s, r = rng.range(0.05, 0.1) * s;
        const g = new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0);
        glow.add(g, k % 2 ? C.crystal : C.crystalB, { matrix: m4(p.x + rng.range(-0.2, 0.2) * s, p.y - 0.02, p.z + rng.range(-0.2, 0.2) * s, rng.range(0, 6), rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)), jitter: 0.1 });
      }
      lights.push({ x: p.x, y: p.y + 0.4, z: p.z, color: '#6fe6ff', range: 3.6 + s * 1.2, intensity: 1.2 * s });
    }

    // ── meshes ──
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.25, strength: 0.6 } });
    bakeLight(geo, lights);
    const rocks = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.group.add(rocks);
    if (look !== 'current' && smoothRocks.length > 0) {
      // the smooth look keeps its own normals: all its loose rocks are one more draw
      const sm = new THREE.Mesh(mergeGeometries(smoothRocks, false), rockMaterial(this.sky, look));
      for (const g of smoothRocks) g.dispose();
      sm.name = 'cove-rocks'; sm.castShadow = true; sm.receiveShadow = true;
      this.group.add(sm);
    }
    const gGeo = glow.finish({ ao: false });
    const gc = gGeo.getAttribute('color');
    for (let i = 0; i < gc.count; i++) gc.setXYZ(i, gc.getX(i) * 2.6, gc.getY(i) * 2.6, gc.getZ(i) * 2.6);
    const glowMesh = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    glowMesh.name = 'cove-glow';
    this.group.add(glowMesh);

    const pools = mergeGeometries(poolParts, false);
    pools.computeBoundingSphere();
    const pmat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a2540'), roughness: 0.4, metalness: 0, transparent: true, opacity: 0.9, flatShading: true });
    this.patchRipple(pmat, 'cove-pool');
    this.sky.setupMaterial(pmat);
    const poolMesh = new THREE.Mesh(pools, pmat);
    poolMesh.receiveShadow = true; poolMesh.renderOrder = 1;
    this.group.add(poolMesh);

    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot, dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz);
      const px = fx + (dx / len) * 1.2, pz = fz + (dz / len) * 1.2;
      this.fall = new Waterfall({ lip: new THREE.Vector3(tx, heightAt(tx, tz) + 0.3, tz), foot: new THREE.Vector3(px, heightAt(fx, fz) + 0.06, pz), width: 2.2 }).build();
      this.group.add(this.fall.group);
    }

    // ── colliders: the cave walls (a 2.5 m throat at the passage), the back wall, the outer mass ──
    const box = (lx: number, lz: number, hw: number, hd: number, y0: number, y1: number): void => {
      const [x, z] = W(lx, lz);
      this.colliders.push({ x, z, hw, hd, rot: -cave.yaw, yTop: y1, yBottom: y0 });
    };
    for (const side of [-1, 1]) {
      box(side * (ANTE.hw + 0.6), ANTE.z1 / 2 - 0.3, 0.6, ANTE.z1 / 2 + 0.3, FLOOR - 2, FLOOR + 7);
      box(side * (PASS.hw + 1.0), (PASS.z0 + PASS.z1) / 2, 1.0, (PASS.z1 - PASS.z0) / 2, FLOOR - 2, FLOOR + 7);
      box(side * (ALC.hw + 0.6), (ALC.z0 + cave.depth) / 2, 0.6, (cave.depth - ALC.z0) / 2, FLOOR - 2, FLOOR + 7);
      box(side * (ANTE.hw + 2.6), cave.depth / 2, 1.5, cave.depth / 2 + 0.8, FLOOR - 2, FLOOR + 7);
    }
    box(0, cave.depth + 0.6, ALC.hw + 1, 0.6, FLOOR - 2, FLOOR + 7);

    // ── anchors ──
    const anchor = (lx: number, lz: number, yaw: number, floor = true): CoveAnchor => {
      const [x, z] = W(lx, lz);
      return { x, z, y: floor && lz >= -0.3 && lz <= cave.depth ? this.floorAt(lz) : heightAt(x, z), yaw: cave.yaw + yaw };
    };
    this.anchors['caveFloor'] = anchor(0, 2.8, Math.PI);
    this.anchors['gate'] = anchor(0, PASS.z0 + 0.25, Math.PI);
    this.anchors['alcove'] = anchor(0, 7.9, Math.PI);
    this.anchors['plateA'] = anchor(-2.9, -4.6, 0, false);
    this.anchors['plateB'] = anchor(2.9, -4.6, 0, false);
    // the barrel that washed up by the wreck's bow, ~8 m from the plates
    this.anchors['barrelStart'] = { x: 147.5, y: heightAt(147.5, 3.5), z: 3.5, yaw: 0 };
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/physics/pieces.ts turns it into Rapier colliders.
   *
   * The nine wall boxes; the floor as three slabs (the antechamber and the passage at 1.2 m, the alcove at 2.2 m); the
   * ramp between them as the four steps the mesh draws (0.25 m rise), alcove-wide so the upper ones meet the alcove's
   * wider floor; and a back-fill block behind the back wall over the far side of `terrainCuts()` — the heightfield
   * under the cave must be cut for any of this floor to be the floor.
   *
   * The drawn ramp is 45° (1 m up over lz 5.8–6.8): four treads 0.25 deep are narrower than the 0.38 m capsule, which
   * then rides their edges as a 45° slope and stops. So the treads run 0.375 m each (34°), lz 5.65–7.15 — from just
   * behind the sluice door (its leaf ends at lz ≈ 5.61) to 0.35 m into the alcove, whose floor the top tread is flush
   * with; the collision is within one rise (0.25 m) of the drawn steps all along.
   */
  colliderDescs(): ColliderDesc[] {
    const c = this.cave, out: ColliderDesc[] = this.colliders.map((b) => boxDesc(b, 'rock'));
    const slab = (hw: number, lz0: number, lz1: number, top: number, bottom: number): ColliderDesc => {
      const [x, z] = this.W(0, (lz0 + lz1) / 2);
      return { kind: 'box', x, y: (top + bottom) / 2, z, hx: hw, hy: (top - bottom) / 2, hz: (lz1 - lz0) / 2, yaw: c.yaw, surface: 'rock' };
    };
    const base = CUT.below - 0.4;
    out.push(slab(ANTE.hw + 0.1, -0.3, PASS.z0, FLOOR, base));
    out.push(slab(PASS.hw + 0.1, PASS.z0, STEPS.z0, FLOOR, base));
    out.push(slab(ALC.hw + 0.1, STEPS.z1, c.depth, ALC_FLOOR, base));
    const at = (lz: number, y: number) => { const [x, z] = this.W(0, lz); return { x, y, z }; };
    out.push({ kind: 'treads', from: at(STEPS.z0, FLOOR), to: at(STEPS.z1, ALC_FLOOR), width: (ALC.hw + 0.1) * 2, count: 4, surface: 'rock' });
    out.push(slab(BACKFILL.hw, c.depth + 0.8, BACKFILL.z1, FLOOR + 7, base));
    return out;
  }

  /**
   * PHYSICS P4: where the terrain heightfield must be pushed down for the cave to be walkable — every heightfield
   * vertex inside a rectangle (centre x, z; half-extents hw across, hd along; turned `yaw` about +Y like a
   * ColliderDesc) takes min(its height, `below`). `below` is under the cave floor.
   */
  terrainCuts(): { x: number; z: number; hw: number; hd: number; yaw: number; below: number }[] {
    const [x, z] = this.W(0, (CUT.z0 + CUT.z1) / 2);
    return [{ x, z, hw: CUT.hw, hd: (CUT.z1 - CUT.z0) / 2, yaw: this.cave.yaw, below: CUT.below }];
  }

  /** the cave's walkable floor under (x, z), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const [lx, lz] = this.L(x, z);
    if (lz < -0.3 || lz > this.cave.depth) return undefined;
    if (Math.abs(lx) > this.halfWidth(lz) + 0.1) return undefined;
    return this.floorAt(lz);
  }

  /** the pools: concentric ripple rings drift outward, the sun catches their crests */
  private patchRipple(mat: THREE.MeshStandardMaterial, key: string) {
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uTime'] = u.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float r = length(fract(vWp.xz * 0.11) - 0.5) * 9.0;          // a ripple centre per 9 m cell (each pool gets its own)
            float w = 0.5 + 0.5 * sin(r * 6.0 - uTime * 2.2) * sin(vWp.x * 3.1 + uTime) ;
            float crest = smoothstep(0.75, 1.0, w);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.4, 0.5), crest * 0.4 + 0.06 * sin(vWp.z * 5.0 + uTime * 1.7));
          }`);
    };
    mat.customProgramCacheKey = () => key;
  }

  update(dt: number): void {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    this.fall?.update(dt);
  }
}

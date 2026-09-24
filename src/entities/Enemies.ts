import * as THREE from 'three';
import { heightAt, waterLevel } from '../world/Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Sky } from '../world/Sky';
import type { PalmSpec } from '../world/Palms';
import type { AnimalManager } from './AnimalManager';
import type { Animal } from './Animal';
import { WRECK } from '../chunks/driftwood-isle';
import { worldTime } from '../core/time';
import { waveHeight } from '../world/waves';
import { getActiveChunk } from '../chunks/registry';
import { activeBodies, type Body, type BodySpec } from '../physics/bodies';
import { groups } from '../physics/groups';

/**
 * Enemies — Driftwood Isle's three enemy species placed into the island's spaces, plus the pieces their AIs need
 * that no animal owns: the palm perches, the coconut projectiles, the water-droplet splash and the Drowned Sailor's
 * cyan point light. The species themselves are registry entries (`src/entities/species/{crab,monkey,sailor}.ts`,
 * `rig: 'custom'` + their own `think`); the AnimalManager still owns them (hit tests, health bars, blood, onKill,
 * corpses), so the sword, Combat.ts and the minimap see them like any boar.
 *
 *   const enemies = new Enemies(animals, { scene, sky, palms, wreck, crabSites }).build();
 *   game.onUpdate((dt, t) => enemies.update(dt, t, player.position));
 *
 *   palms      the PalmSpec[] the island's Palms were built from (Palms.scatterIsland) — the crowns become monkey perches
 *              (`animals.enemyWorld.perches` / `perchBases`), troops of 3–4 are spawned into the densest groves
 *   wreck      the Wreck (floorHeightAt) — the hold: the sailor rises through the broken midships deck beside the iron sword
 *   crabSites  tidepool spots ({x, z}[], e.g. Cove.crabSites) — a group of 3–5 crabs (one big) at each
 *
 * Damage to the player from every enemy attack (crab snap 10, coconut 8, monkey bite 6, cutlass 18) arrives through
 * `animals.onCharge(animal, damage)` — the same hook a boar charge uses, so main.ts needs no new wiring for it.
 * Coconuts (PHYSICS P7): a 16-slot InstancedMesh of faceted brown spheres (one draw call), each a dynamic ball in the
 * physics world (src/physics/bodies.ts) — thrown on a ballistic arc, it bounces, rolls down the beach and floats on the
 * swell. In flight it is DEBRIS (the world only) and a hit is the ball passing within 0.45 m of the player's feet→head
 * segment; once it lands it is an ITEM the player nudges. It goes after resting 4 s (or 16 s of bobbing). Splash: a pooled Points
 * burst (cyan-white droplets, gravity). The sailor's light: one PointLight at its skull while it is up, off at death.
 */

export interface EnemiesOpts {
  scene: THREE.Scene;
  sky: Sky;
  palms?: PalmSpec[];
  wreck?: { floorHeightAt: (x: number, z: number) => number | undefined } | null;
  crabSites?: { x: number; z: number }[];
  /** the player spawn to keep troops away from (default the pier landing) */
  spawn?: { x: number; z: number };
  /** monkey troops to place (default 3) */
  troops?: number;
}

const COCONUTS = 16, COCONUT_R = 0.13, G = 9.81, REST_T = 4, MAX_AGE = 16;
/** a knock this hard (m/s of velocity change) in flight is the landing */
const LAND_IMPACT = 1.5;
/** below this speed (m/s) a landed coconut counts as resting */
const REST_SPEED = 0.15;
const DEBRIS_GROUPS = groups('DEBRIS');
/** the sea surface a coconut floats on: the still level + the swell, where the ground is under water */
const seaSurface = (x: number, z: number): number | undefined => {
  const lvl = waterLevel();
  if (heightAt(x, z) >= lvl) return undefined;
  return getActiveChunk().ocean ? lvl + waveHeight(x, z) : lvl;
};
/** a coconut's body (PHYSICS P7): a light ball that bounces a little, rolls (its spin damped so it stops on the flat) and
 *  floats (lighter than water); DEBRIS in flight; removed, not frozen, when the body cap is full */
export const COCONUT_BODY = {
  shape: { ball: COCONUT_R }, material: 'wood', group: 'DEBRIS', density: 650, friction: 0.7, restitution: 0.35,
  angularDamping: 3, ccd: true, expendable: true, float: { surface: seaSurface, buoyancy: 1.6, drag: 1.5 },
} as const satisfies Omit<BodySpec, 'owner'>;
const DROPS = 240;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class Enemies {
  group = new THREE.Group();
  /** what was placed (for the dev harness / report) */
  placed = { crabs: 0, monkeys: 0, sailors: 0, troops: 0, crabGroups: 0 };
  private rng = new Rng(SEED ^ 0xe11e);
  private coconuts!: THREE.InstancedMesh;
  private cBody: (Body | null)[] = [];
  private cState = new Int8Array(COCONUTS);     // 0 free, 1 flying, 2 landed
  private cRest = new Float32Array(COCONUTS);   // seconds at rest (landed)
  private cAge = new Float32Array(COCONUTS);
  private cThrower: (Animal | null)[] = [];
  private cNext = 0;
  private drops!: THREE.Points;
  private dPos = new Float32Array(DROPS * 3);
  private dVel = new Float32Array(DROPS * 3);
  private dLife = new Float32Array(DROPS);
  private dAttr!: THREE.BufferAttribute;
  private dNext = 0; private dActive = 0;
  private sailors: { a: Animal; light: THREE.PointLight; dead: boolean; fade: number }[] = [];
  private playerPos = new THREE.Vector3();

  constructor(private readonly animals: AnimalManager, private readonly opts: EnemiesOpts) { this.group.name = 'enemies'; }

  build(): this {
    const { opts, animals } = this;
    // ── the pieces the AIs read (AnimalManager.enemyWorld) ──
    const W = animals.enemyWorld;
    if (opts.palms?.length) {
      W.perches = []; W.perchBases = [];
      for (const p of opts.palms) {
        const base = heightAt(p.x, p.z) - 0.2;
        W.perches.push(new THREE.Vector3(p.x + Math.cos(p.leanDir) * p.lean * p.h, base + p.h + 0.5, p.z + Math.sin(p.leanDir) * p.lean * p.h));
        W.perchBases.push(new THREE.Vector3(p.x, base + 0.2, p.z));
      }
    }
    W.throwCoconut = (from, to, thrower) => { this.throwCoconut(from, to, thrower); };
    W.splash = (at, strength) => { this.splash(at, strength); };
    // ── coconuts: one InstancedMesh ──
    {
      const g = new THREE.IcosahedronGeometry(COCONUT_R, 0);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a3d22'), flatShading: true, roughness: 0.85, metalness: 0 });
      opts.sky.setupMaterial(mat);
      this.coconuts = new THREE.InstancedMesh(g, mat, COCONUTS);
      this.coconuts.castShadow = true; this.coconuts.frustumCulled = false;
      for (let i = 0; i < COCONUTS; i++) { this.coconuts.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.cThrower.push(null); this.cBody.push(null); }
      this.coconuts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(this.coconuts);
    }
    // ── droplets ──
    {
      const g = new THREE.BufferGeometry();
      this.dAttr = new THREE.BufferAttribute(this.dPos, 3); this.dAttr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.dAttr);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.75, 0.95, 1.0), size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, map: dropTexture(), alphaTest: 0.3 });
      this.drops = new THREE.Points(g, mat); this.drops.frustumCulled = false; this.drops.renderOrder = 5;
      for (let i = 0; i < DROPS; i++) this.dPos[i * 3 + 1] = -1000;
      this.group.add(this.drops);
    }
    this.placeCrabs();
    this.placeMonkeys();
    this.placeSailor();
    opts.scene.add(this.group);
    return this;
  }

  // ── placement ──────────────────────────────────────────────────────────────────────────

  private placeCrabs(): void {
    const sites = this.opts.crabSites ?? [];
    const rng = this.rng;
    for (const s of sites) {
      const n = rng.int(3, 5);
      const herd = this.animals.addHerd('crab', s.x, s.z);
      for (let i = 0; i < n; i++) {
        const ang = rng.range(0, Math.PI * 2), r = i === 0 ? 0 : rng.range(1.2, 2.8);
        const x = s.x + Math.cos(ang) * r, z = s.z + Math.sin(ang) * r;
        if (heightAt(x, z) < waterLevel() + 0.15) continue;
        const a = this.animals.spawn('crab', x, z, rng.range(0, Math.PI * 2), i === 0 ? 'big' : 'small');
        a.herd = herd; this.animals.herds[herd]?.members.push(a);
        this.placed.crabs++;
      }
      this.placed.crabGroups++;
    }
  }

  private placeMonkeys(): void {
    const palms = this.opts.palms ?? [];
    if (palms.length < 4) return;
    const rng = this.rng;
    const spawn = this.opts.spawn ?? { x: 0, z: -235 };
    // grove density: neighbours within 10 m
    const score = palms.map((p) => { let n = 0; for (const q of palms) if (q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 10) n++; return n; });
    const order = palms.map((_, i) => i).filter((i) => (score[i] ?? 0) >= 3).sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
    const centres: PalmSpec[] = [];
    for (const i of order) {
      const p = palms[i];
      if (p === undefined) continue;
      if (centres.length >= (this.opts.troops ?? 3)) break;
      if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 60) continue;
      if (Math.hypot(p.x - WRECK.x, p.z - WRECK.z) < 30) continue;
      if (centres.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 45)) continue;
      centres.push(p);
    }
    for (const c of centres) {
      const grove = palms.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 10);
      const n = Math.min(grove.length, rng.int(3, 4));
      const herd = this.animals.addHerd('monkey', c.x, c.z);
      for (let i = 0; i < n; i++) {
        const p = grove[i];
        if (p === undefined) continue;
        const a = this.animals.spawn('monkey', p.x, p.z, rng.range(0, Math.PI * 2));
        a.herd = herd; this.animals.herds[herd]?.members.push(a);
        this.placed.monkeys++;
      }
      this.placed.troops++;
    }
  }

  private placeSailor(): void {
    const wreck = this.opts.wreck;
    if (wreck === null || wreck === undefined) return;
    // hull frame (Wreck.ts): local x = starboard, z = stern; the hold hatch is the broken midships deck (local z 0..4.8),
    // the iron sword hovers at local (-0.7, 4.2) (IronSword.ts) — the sailor rises 2 m forward of it, a little to starboard
    const h = WRECK.heading, cs = Math.cos(h), sn = Math.sin(h);
    const at = (lx: number, lz: number): { x: number; z: number } => ({ x: WRECK.x + lx * cs + lz * sn, z: WRECK.z - lx * sn + lz * cs });
    const spot = at(0.5, 2.2), centre = at(0, 3.2);
    this.animals.enemyWorld.hold = { x: centre.x, z: centre.z, r: 7.5, guardR: 8, floorAt: (x, z) => wreck.floorHeightAt(x, z) };
    const a = this.animals.spawn('sailor', spot.x, spot.z, h + Math.PI, 'sailor');
    a.herd = -1;
    const light = new THREE.PointLight(0x7fe8ff, 0, 7, 2);
    light.castShadow = false;
    this.group.add(light);
    this.sailors.push({ a, light, dead: false, fade: 0 });
    this.placed.sailors++;
  }

  // ── projectiles + fx ───────────────────────────────────────────────────────────────────

  /** lob a coconut from `from` to land on `to` in 0.8–1.5 s (the flight time grows with the range) */
  throwCoconut(from: THREE.Vector3, to: THREE.Vector3, thrower: Animal | null): void {
    const bodies = activeBodies();
    if (bodies === null) return;
    const k = this.cNext; this.cNext = (this.cNext + 1) % COCONUTS;
    this.freeCoconut(k);
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const T = THREE.MathUtils.clamp(Math.hypot(dx, dz) / 9, 0.8, 1.5);
    const spin = this.rng.range(0, 6.28);
    _q.setFromEuler(_e.set(spin, spin * 0.7, 0));
    const spec: BodySpec = {
      ...COCONUT_BODY, owner: this,
      onRemoved: (b) => { if (this.cBody[k] === b) { this.cBody[k] = null; this.cState[k] = 0; this.coconuts.setMatrixAt(k, _m.makeScale(0, 0, 0)); this.coconuts.instanceMatrix.needsUpdate = true; } },
    };
    const b = bodies.spawn(spec, from, { x: dx / T, y: dy / T + 0.5 * G * T, z: dz / T }, _q);
    b.rb.setAngvel({ x: this.rng.range(-7, 7), y: this.rng.range(-3, 3), z: this.rng.range(-7, 7) }, true);
    this.cBody[k] = b; this.cState[k] = 1; this.cRest[k] = 0; this.cAge[k] = 0; this.cThrower[k] = thrower;
  }

  /** take slot `k`'s coconut out of the world */
  private freeCoconut(k: number): void {
    const b = this.cBody[k];
    this.cBody[k] = null; this.cState[k] = 0;
    if (b) activeBodies()?.remove(b);
    this.coconuts.setMatrixAt(k, _m.makeScale(0, 0, 0));
  }

  /** a flying coconut came down: from now on the player nudges it and plates feel it */
  private land(k: number, b: Body): void {
    this.cState[k] = 2; this.cRest[k] = 0;
    b.setGroup('ITEM');
  }

  /** a burst of water droplets at `at` (strength 1 = the sailor surfacing) */
  splash(at: THREE.Vector3, strength = 1): void {
    const n = Math.round(60 * strength);
    for (let i = 0; i < n; i++) {
      const k = this.dNext; this.dNext = (this.dNext + 1) % DROPS;
      const ang = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
      this.dPos[k * 3] = at.x + Math.cos(ang) * r; this.dPos[k * 3 + 1] = at.y + 0.2 + Math.random() * 1.4 * strength; this.dPos[k * 3 + 2] = at.z + Math.sin(ang) * r;
      const s = 0.6 + Math.random() * 2.2;
      this.dVel[k * 3] = Math.cos(ang) * s; this.dVel[k * 3 + 1] = 1.2 + Math.random() * 2.5; this.dVel[k * 3 + 2] = Math.sin(ang) * s;
      this.dLife[k] = 0.5 + Math.random() * 0.6;
    }
    this.dActive = Math.min(DROPS, this.dActive + n);
  }

  update(dt: number, t: number, playerPos: THREE.Vector3): void {
    this.playerPos.copy(playerPos);
    // ── coconuts: their bodies fly, bounce, roll and float in the physics world; this reads them ──
    const bodies = activeBodies();
    let dirty = false;
    for (let k = 0; k < COCONUTS; k++) {
      const st = this.cState[k], b = this.cBody[k];
      if (!st || b === null || b === undefined || bodies === null) continue;
      dirty = true;
      b.pose(bodies.alpha, _v, _q);
      const age = (this.cAge[k] ?? 0) + dt; this.cAge[k] = age;
      if (st === 1) {
        // the player: feet → head segment
        const cy = THREE.MathUtils.clamp(_v.y, playerPos.y, playerPos.y + 1.75);
        if ((_v.x - playerPos.x) ** 2 + (cy - _v.y) ** 2 + (_v.z - playerPos.z) ** 2 < 0.45 * 0.45) {
          const th = this.cThrower[k];
          if (th !== null && th !== undefined) this.animals.onCharge?.(th, 8);
          this.animals.onSound?.('coconut_hit', _v);
          const vel = b.rb.linvel();
          b.launch({ x: vel.x * -0.2, y: 1.5, z: vel.z * -0.2 });   // bounces off you (still DEBRIS: it is inside your capsule)
          this.cState[k] = 2; this.cRest[k] = 0;
          continue;
        }
        if (b.takeImpact() > LAND_IMPACT || b.wet > 0 || age > 3) {
          if (age <= 3) this.animals.onSound?.('coconut_land', _v);
          if (b.wet > 0) this.splash(_v, 0.3);
          this.land(k, b);
        }
      } else {
        if (b.collider.collisionGroups() === DEBRIS_GROUPS && Math.hypot(_v.x - playerPos.x, _v.z - playerPos.z) > 0.8) b.setGroup('ITEM'); // clear of you after a bounce
        const rest = b.rb.isSleeping() || b.speed < REST_SPEED;
        this.cRest[k] = rest ? (this.cRest[k] ?? 0) + dt : 0;
        if ((this.cRest[k] ?? 0) > REST_T || age > MAX_AGE) { this.freeCoconut(k); continue; }
      }
      _m.compose(_v, _q, _s.set(1, 1, 1));
      this.coconuts.setMatrixAt(k, _m);
    }
    if (dirty) this.coconuts.instanceMatrix.needsUpdate = true;
    // ── droplets ──
    if (this.dActive) {
      const rdt = worldTime.realDt || dt; // droplets keep falling through a hit-stop
      let alive = 0;
      const life = this.dLife, pos = this.dPos, vel = this.dVel;
      for (let k = 0; k < DROPS; k++) {
        const l0 = life[k] ?? 0;
        if (l0 <= 0) continue;
        life[k] = l0 - rdt;
        if ((life[k] ?? 0) <= 0) { pos[k * 3 + 1] = -1000; continue; }
        alive++;
        const j = k * 3;
        vel[j + 1] = (vel[j + 1] ?? 0) - G * rdt;
        pos[j] = (pos[j] ?? 0) + (vel[j] ?? 0) * rdt; pos[j + 1] = (pos[j + 1] ?? 0) + (vel[j + 1] ?? 0) * rdt; pos[j + 2] = (pos[j + 2] ?? 0) + (vel[j + 2] ?? 0) * rdt;
      }
      this.dActive = alive;
      this.dAttr.needsUpdate = true;
    }
    // ── the sailor's light: at the skull while it is up; a burst of droplets and lights-out when it dies ──
    for (const s of this.sailors) {
      const a = s.a;
      a.headWorld(_w);
      s.light.position.copy(_w).y += 0.1;
      if (!a.alive && !s.dead) { s.dead = true; s.fade = 1; this.splash(a.position, 1.4); }
      if (s.dead) { s.fade = Math.max(0, s.fade - dt * 1.6); s.light.intensity = 4.5 * s.fade; continue; } // stays in the scene at 0: hiding it changes the light count → every lit program recompiles (B7)
      const up = THREE.MathUtils.clamp(a.mem['rise'] ?? 0, 0, 1);
      const flick = 0.85 + 0.15 * Math.sin(t * 11 + Math.sin(t * 3.7) * 2);
      s.light.intensity = 4.5 * up * flick * (a.position.distanceToSquared(playerPos) < 60 * 60 ? 1 : 0);
      // streaming water while it rises
      if (a.mem['rising'] && Math.random() < dt * 30) { _v.copy(a.position); _v.y += 0.5 + Math.random() * 1.2 * up; this.splash(_v, 0.08); }
    }
  }
}

function dropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Enemies: could not get a 2d canvas context');
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

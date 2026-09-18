import * as THREE from 'three';
import { heightAt, waterLevel } from '../world/Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Sky } from '../world/Sky';
import type { PalmSpec } from '../world/Palms';
import type { AnimalManager } from './AnimalManager';
import type { Animal } from './Animal';
import { WRECK } from '../chunks/driftwood-isle';

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
 * Coconuts: a 16-slot InstancedMesh of faceted brown spheres on ballistic arcs (one draw call); a hit is the sphere
 * passing within 0.45 m of the player's feet→head segment; a landed one lies on the sand 4 s. Splash: a pooled Points
 * burst (cyan-white droplets, gravity). The sailor's light: one PointLight at its skull while it is up, off at death.
 */

export interface EnemiesOpts {
  scene: THREE.Scene;
  sky: Sky;
  palms?: PalmSpec[];
  wreck?: { floorHeightAt(x: number, z: number): number | undefined } | null;
  crabSites?: { x: number; z: number }[];
  /** the player spawn to keep troops away from (default the pier landing) */
  spawn?: { x: number; z: number };
  /** monkey troops to place (default 3) */
  troops?: number;
}

const COCONUTS = 16, COCONUT_R = 0.13, G = 9.8, REST_T = 4;
const DROPS = 240;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class Enemies {
  group = new THREE.Group();
  /** what was placed (for the dev harness / report) */
  placed = { crabs: 0, monkeys: 0, sailors: 0, troops: 0, crabGroups: 0 };
  private rng = new Rng(SEED ^ 0xe11e);
  private coconuts!: THREE.InstancedMesh;
  private cPos = new Float32Array(COCONUTS * 3);
  private cVel = new Float32Array(COCONUTS * 3);
  private cState = new Int8Array(COCONUTS);     // 0 free, 1 flying, 2 resting
  private cRest = new Float32Array(COCONUTS);
  private cSpin = new Float32Array(COCONUTS);
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

  constructor(private animals: AnimalManager, private opts: EnemiesOpts) { this.group.name = 'enemies'; }

  build() {
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
    W.throwCoconut = (from, to, thrower) => this.throwCoconut(from, to, thrower);
    W.splash = (at, strength) => this.splash(at, strength);
    // ── coconuts: one InstancedMesh ──
    {
      const g = new THREE.IcosahedronGeometry(COCONUT_R, 0);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a3d22'), flatShading: true, roughness: 0.85, metalness: 0 });
      opts.sky.setupMaterial(mat);
      this.coconuts = new THREE.InstancedMesh(g, mat, COCONUTS);
      this.coconuts.castShadow = true; this.coconuts.frustumCulled = false;
      for (let i = 0; i < COCONUTS; i++) { this.coconuts.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.cThrower.push(null); }
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

  private placeCrabs() {
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
        a.herd = herd; this.animals.herds[herd].members.push(a);
        this.placed.crabs++;
      }
      this.placed.crabGroups++;
    }
  }

  private placeMonkeys() {
    const palms = this.opts.palms ?? [];
    if (palms.length < 4) return;
    const rng = this.rng;
    const spawn = this.opts.spawn ?? { x: 0, z: -235 };
    // grove density: neighbours within 10 m
    const score = palms.map((p) => { let n = 0; for (const q of palms) if (q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 10) n++; return n; });
    const order = palms.map((_, i) => i).filter((i) => score[i] >= 3).sort((a, b) => score[b] - score[a]);
    const centres: PalmSpec[] = [];
    for (const i of order) {
      const p = palms[i];
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
        const a = this.animals.spawn('monkey', p.x, p.z, rng.range(0, Math.PI * 2));
        a.herd = herd; this.animals.herds[herd].members.push(a);
        this.placed.monkeys++;
      }
      this.placed.troops++;
    }
  }

  private placeSailor() {
    const wreck = this.opts.wreck;
    if (!wreck) return;
    // hull frame (Wreck.ts): local x = starboard, z = stern; the hold hatch is the broken midships deck (local z 0..4.8),
    // the iron sword hovers at local (-0.7, 4.2) (IronSword.ts) — the sailor rises 2 m forward of it, a little to starboard
    const h = WRECK.heading, cs = Math.cos(h), sn = Math.sin(h);
    const at = (lx: number, lz: number) => ({ x: WRECK.x + lx * cs + lz * sn, z: WRECK.z - lx * sn + lz * cs });
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
  throwCoconut(from: THREE.Vector3, to: THREE.Vector3, thrower: Animal | null) {
    const k = this.cNext; this.cNext = (this.cNext + 1) % COCONUTS;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const T = THREE.MathUtils.clamp(Math.hypot(dx, dz) / 9, 0.8, 1.5);
    this.cPos[k * 3] = from.x; this.cPos[k * 3 + 1] = from.y; this.cPos[k * 3 + 2] = from.z;
    this.cVel[k * 3] = dx / T; this.cVel[k * 3 + 1] = dy / T + 0.5 * G * T; this.cVel[k * 3 + 2] = dz / T;
    this.cState[k] = 1; this.cSpin[k] = this.rng.range(0, 6.28); this.cThrower[k] = thrower;
  }

  /** a burst of water droplets at `at` (strength 1 = the sailor surfacing) */
  splash(at: THREE.Vector3, strength = 1) {
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

  update(dt: number, t: number, playerPos: THREE.Vector3) {
    this.playerPos.copy(playerPos);
    // ── coconuts ──
    let dirty = false;
    for (let k = 0; k < COCONUTS; k++) {
      const st = this.cState[k];
      if (!st) continue;
      dirty = true;
      const i = k * 3;
      if (st === 1) {
        this.cVel[i + 1] -= G * dt;
        this.cPos[i] += this.cVel[i] * dt; this.cPos[i + 1] += this.cVel[i + 1] * dt; this.cPos[i + 2] += this.cVel[i + 2] * dt;
        this.cSpin[k] += 7 * dt;
        // the player: feet → head segment
        const px = playerPos.x, pz = playerPos.z, py0 = playerPos.y, py1 = playerPos.y + 1.75;
        const cy = THREE.MathUtils.clamp(this.cPos[i + 1], py0, py1);
        const d2 = (this.cPos[i] - px) ** 2 + (cy - this.cPos[i + 1]) ** 2 + (this.cPos[i + 2] - pz) ** 2;
        if (d2 < 0.45 * 0.45) {
          const th = this.cThrower[k];
          if (th) this.animals.onCharge?.(th, 8);
          this.animals.onSound?.('coconut_hit', _v.set(this.cPos[i], this.cPos[i + 1], this.cPos[i + 2]));
          this.cState[k] = 2; this.cRest[k] = 1.2; this.cVel[i] *= -0.2; this.cVel[i + 2] *= -0.2; this.cVel[i + 1] = 1.5;   // bounces off you
          continue;
        }
        const ground = Math.max(heightAt(this.cPos[i], this.cPos[i + 2]), waterLevel());
        if (this.cPos[i + 1] <= ground + COCONUT_R) {
          this.cPos[i + 1] = ground + COCONUT_R;
          this.cState[k] = 2; this.cRest[k] = REST_T;
          this.animals.onSound?.('coconut_land', _v.set(this.cPos[i], this.cPos[i + 1], this.cPos[i + 2]));
          if (ground <= waterLevel() + 0.01) this.splash(_v, 0.3);
        }
      } else {
        this.cRest[k] -= dt;
        if (this.cVel[i + 1] > 0 || this.cPos[i + 1] > heightAt(this.cPos[i], this.cPos[i + 2]) + COCONUT_R + 0.01) {   // the bounce off the player
          this.cVel[i + 1] -= G * dt; this.cPos[i] += this.cVel[i] * dt; this.cPos[i + 1] += this.cVel[i + 1] * dt; this.cPos[i + 2] += this.cVel[i + 2] * dt;
          const g = heightAt(this.cPos[i], this.cPos[i + 2]) + COCONUT_R;
          if (this.cPos[i + 1] < g) { this.cPos[i + 1] = g; this.cVel[i] = this.cVel[i + 1] = this.cVel[i + 2] = 0; this.cRest[k] = REST_T; }
        }
        if (this.cRest[k] <= 0) { this.cState[k] = 0; this.coconuts.setMatrixAt(k, _m.makeScale(0, 0, 0)); continue; }
      }
      _q.setFromEuler(_e.set(this.cSpin[k], this.cSpin[k] * 0.7, 0));
      _m.compose(_v.set(this.cPos[i], this.cPos[i + 1], this.cPos[i + 2]), _q, _s.set(1, 1, 1));
      this.coconuts.setMatrixAt(k, _m);
    }
    if (dirty) this.coconuts.instanceMatrix.needsUpdate = true;
    // ── droplets ──
    if (this.dActive) {
      let alive = 0;
      for (let k = 0; k < DROPS; k++) {
        if (this.dLife[k] <= 0) continue;
        this.dLife[k] -= dt;
        if (this.dLife[k] <= 0) { this.dPos[k * 3 + 1] = -1000; continue; }
        alive++;
        this.dVel[k * 3 + 1] -= G * dt;
        this.dPos[k * 3] += this.dVel[k * 3] * dt; this.dPos[k * 3 + 1] += this.dVel[k * 3 + 1] * dt; this.dPos[k * 3 + 2] += this.dVel[k * 3 + 2] * dt;
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
      if (s.dead) { s.fade = Math.max(0, s.fade - dt * 1.6); s.light.intensity = 4.5 * s.fade; if (s.fade <= 0) s.light.visible = false; continue; }
      const up = THREE.MathUtils.clamp(a.mem.rise ?? 0, 0, 1);
      const flick = 0.85 + 0.15 * Math.sin(t * 11 + Math.sin(t * 3.7) * 2);
      s.light.intensity = 4.5 * up * flick * (a.position.distanceToSquared(playerPos) < 60 * 60 ? 1 : 0);
      // streaming water while it rises
      if (a.mem.rising && Math.random() < dt * 30) { _v.copy(a.position); _v.y += 0.5 + Math.random() * 1.2 * up; this.splash(_v, 0.08); }
    }
  }
}

function dropTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

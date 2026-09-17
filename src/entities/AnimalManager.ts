import * as THREE from 'three';
import { SEED, CHUNK_HALF } from '../core/config';
import { Rng } from '../core/rng';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk } from '../world/Heightfield';
import type { Forest } from '../world/Forest';
import type { Sky } from '../world/Sky';
import { AnimalFactory, type AnimalKind, type AnimalModel } from './AnimalFactory';
import { Animal } from './Animal';

/**
 * AnimalManager — spawns the chunk's huntable wildlife (3 deer herds, 2 boar sounders),
 * runs their AI at 10 Hz (idle / graze / wander / alert / flee / charge / dead), animates
 * them every frame, and exposes the combat + audio hooks.
 *
 *   const animals = new AnimalManager(scene, sky, forest).build();
 *   game.onUpdate((dt, t) => animals.update(dt, t, player.position, player.sprinting));
 *
 *   animals.raycast(origin, dir, maxDist) → { animal, point, distance, headshot } | null
 *   animal.applyDamage(amount, hitPoint, dir) → true if it died   (deer 60 hp, boar 90 hp)
 *   animals.hit(hit, damage, dir)  — convenience: applies damage (headshot ×3), blood, events
 *   animals.onKill   = (animal) => …
 *   animals.onCharge = (animal, damage) => …          a boar reached the player
 *   animals.onSound  = (name, position) => …          'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal'
 *   animals.animals: Animal[]   animals.alive (count)
 *
 * Dev helpers: animals.spawn(kind, x, z, yaw, variant?) adds a single animal (no herd AI target),
 * animals.debug = true draws the hit capsules, animals.calm = true stops them reacting to the player.
 */

export interface AnimalHit { animal: Animal; point: THREE.Vector3; distance: number; headshot: boolean }
export type AnimalSound = 'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal';

interface Herd { kind: AnimalKind; cx: number; cz: number; members: Animal[] }

interface Brain {
  timer: number;        // time left in the current state
  tx: number; tz: number; // wander target
  fleeT: number;
  chargeCd: number;
  callT: number;
  hurtT: number;
  scared: number;       // alert timer before bolting
}

const DEER_WALK = 1.3, DEER_RUN = 9.5, BOAR_WALK = 1.1, BOAR_RUN = 6.8, BOAR_CHARGE = 7.5;
const ALERT_DIST = 30, ALERT_DIST_BOAR = 22, SPRINT_DIST = 45, FLEE_DIST = 18, CHARGE_DIST = 6;
const ANIM_LOD = 140;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

export class AnimalManager {
  group = new THREE.Group();
  animals: Animal[] = [];
  herds: Herd[] = [];
  factory: AnimalFactory;
  onKill?: (animal: Animal) => void;
  onCharge?: (animal: Animal, damage: number) => void;
  onSound?: (name: AnimalSound, position: THREE.Vector3) => void;
  debug = false;
  /** dev: animals ignore the player (no alert / flee) */
  calm = false;
  private brains = new Map<Animal, Brain>();
  private rng = new Rng(SEED + 31);
  private thinkAcc = 0;
  private blood!: BloodFX;
  private debugMeshes: THREE.Mesh[] = [];
  private playerPos = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private sky: Sky, private forest: Forest) {
    this.factory = new AnimalFactory(sky);
    this.group.name = 'animals';
  }

  get alive() { let n = 0; for (const a of this.animals) if (a.alive) n++; return n; }

  build() {
    this.blood = new BloodFX(this.sky);
    this.group.add(this.blood.group);
    this.spawnHerds();
    this.scene.add(this.group);
    return this;
  }

  // ── spawning ───────────────────────────────────────────────────────────────────────────

  private isOpen(x: number, z: number, clearingR: number) {
    if (!inChunk(x, z, 22)) return false;
    if (trailDistance(x, z) < 12) return false;
    if (cabinMask(x, z) > 0) return false;
    if (normalAt(x, z)[1] < 0.8) return false;
    if (this.forest.nearby(x, z, clearingR).length > (clearingR > 3 ? 2 : 0)) return false;
    return true;
  }

  private spawnHerds() {
    const rng = this.rng;
    const plan: { kind: AnimalKind; n: number }[] = [{ kind: 'deer', n: 5 }, { kind: 'deer', n: 5 }, { kind: 'deer', n: 4 }, { kind: 'boar', n: 5 }, { kind: 'boar', n: 5 }];
    const centres: [number, number][] = [];
    for (const h of plan) {
      let cx = 0, cz = 0, ok = false;
      for (let tries = 0; tries < 400 && !ok; tries++) {
        cx = rng.range(-215, 215); cz = rng.range(-215, 215);
        if (!this.isOpen(cx, cz, 7)) continue;
        if (Math.hypot(cx, cz + 235) < 45) continue;                       // not on top of the spawn point
        if (centres.some(([x, z]) => Math.hypot(x - cx, z - cz) < 70)) continue;
        ok = true;
      }
      if (!ok) continue;
      centres.push([cx, cz]);
      const herd: Herd = { kind: h.kind, cx, cz, members: [] };
      this.herds.push(herd);
      for (let i = 0; i < h.n; i++) {
        let px = cx, pz = cz, placed = false;
        for (let tries = 0; tries < 40 && !placed; tries++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(1.5, 9);
          px = cx + Math.cos(ang) * r; pz = cz + Math.sin(ang) * r;
          if (!this.isOpen(px, pz, 1.2)) continue;
          if (herd.members.some((m) => Math.hypot(m.position.x - px, m.position.z - pz) < 1.8)) continue;
          placed = true;
        }
        if (!placed) continue;
        const variant = h.kind === 'boar' ? 'boar' : i === 0 ? 'stag' : 'hind';
        const a = this.spawn(h.kind, px, pz, rng.range(0, Math.PI * 2), variant);
        a.herd = this.herds.length - 1;
        herd.members.push(a);
      }
    }
  }

  /** Add one animal (also used by the dev showcase). */
  spawn(kind: AnimalKind, x: number, z: number, yaw: number, variant: 'stag' | 'hind' | 'boar' = kind === 'boar' ? 'boar' : 'hind'): Animal {
    const model = this.factory.model(kind, variant);
    const scale = kind === 'deer' ? (variant === 'stag' ? this.rng.range(1.04, 1.12) : this.rng.range(0.94, 1.02)) : this.rng.range(0.92, 1.1);
    const rig = this.factory.instantiate(model, this.rng.next());
    const a = new Animal(rig, model, this.rng.next(), scale);
    a.place(x, z, yaw);
    a.herd = -1;
    a.onFootfall = this.footfall;
    a.sampleTerrain();
    this.group.add(a.mesh);
    this.animals.push(a);
    this.brains.set(a, { timer: this.rng.range(1, 4), tx: x, tz: z, fleeT: 0, chargeCd: 0, callT: this.rng.range(10, 60), hurtT: 0, scared: 0 });
    return a;
  }

  private footfall = (a: Animal, strength: number) => {
    if (!this.onSound) return;
    if (a.position.distanceToSquared(this.playerPos) > 35 * 35) return;
    if (strength > 0.5) this.onSound('hoofsteps', a.position);
  };

  // ── per frame ──────────────────────────────────────────────────────────────────────────

  update(dt: number, t: number, playerPos: THREE.Vector3, playerSprinting = false) {
    this.playerPos.copy(playerPos);
    // AI at 10 Hz, staggered across animals so the cost is flat
    this.thinkAcc += dt;
    const n = this.animals.length;
    if (this.thinkAcc >= 0.1) {
      this.thinkAcc -= 0.1;
      for (let i = 0; i < n; i++) this.think(this.animals[i], 0.1, playerPos, playerSprinting);
    }
    for (let i = 0; i < n; i++) {
      const a = this.animals[i];
      const near = a.position.distanceToSquared(playerPos) < ANIM_LOD * ANIM_LOD;
      a.update(dt, t, near);
    }
    this.blood.update(dt);
    if (this.debug) this.updateDebug();
  }

  private think(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean) {
    const br = this.brains.get(a)!;
    if (!a.alive) { a.lookWeight = 0; return; }
    const rng = this.rng;
    const dx = player.x - a.position.x, dz = player.z - a.position.z;
    const dPlayer = Math.hypot(dx, dz);
    const boar = a.kind === 'boar';
    const alertD = boar ? ALERT_DIST_BOAR : ALERT_DIST;
    const threat = !this.calm && (dPlayer < alertD || (sprinting && dPlayer < SPRINT_DIST));
    br.chargeCd = Math.max(0, br.chargeCd - dt);
    br.hurtT = Math.max(0, br.hurtT - dt);
    if (a.hp < a.maxHp) br.hurtT = 6;
    a.sampleTerrain();

    // ambient calls
    br.callT -= dt;
    if (br.callT <= 0) {
      br.callT = rng.range(20, 90);
      if (dPlayer < 80) this.onSound?.(boar ? 'boar_grunt' : 'deer_call', a.position);
    }

    const herd = a.herd >= 0 ? this.herds[a.herd] : null;
    const hurtCharge = boar && a.hp < a.maxHp && dPlayer < CHARGE_DIST && br.chargeCd <= 0;

    switch (a.state) {
      case 'idle': case 'graze': case 'wander': {
        if (threat) { this.enter(a, br, 'alert'); break; }
        br.timer -= dt;
        if (a.state === 'wander') {
          const tdx = br.tx - a.position.x, tdz = br.tz - a.position.z;
          const td = Math.hypot(tdx, tdz);
          if (td < 1.2 || br.timer <= 0) { this.enter(a, br, rng.next() < 0.6 ? 'graze' : 'idle'); break; }
          this.steer(a, Math.atan2(tdx, tdz), boar ? BOAR_WALK : DEER_WALK, 1.8);
        } else {
          a.setMotion(a.desiredYaw, 0, 1.5);
          if (br.timer <= 0) {
            const r = rng.next();
            if (r < 0.45) this.enter(a, br, 'wander'); else this.enter(a, br, r < 0.8 ? 'graze' : 'idle');
          }
        }
        // occasional glance at the player when they are visible but not yet a threat
        a.lookWeight = dPlayer < 55 && Math.sin(a.seed * 20 + performance.now() * 0.0004) > 0.5 ? 0.6 : 0;
        a.lookTarget.copy(player);
        break;
      }
      case 'alert': {
        a.setMotion(a.desiredYaw, 0, 2.0);
        a.lookTarget.copy(player); a.lookWeight = 1;
        br.scared -= dt;
        if (hurtCharge) { this.enter(a, br, 'charge'); break; }
        if (dPlayer < FLEE_DIST || (br.scared <= 0 && threat) || a.hp < a.maxHp) { this.enter(a, br, 'flee'); break; }
        if (!threat && dPlayer > alertD + 10) { br.timer -= dt; if (br.timer <= 0) this.enter(a, br, 'graze'); }
        else br.timer = 2.5;
        break;
      }
      case 'flee': {
        br.fleeT -= dt;
        if (hurtCharge && rng.next() < 0.6) { this.enter(a, br, 'charge'); break; }
        // run away, biased back toward the herd's side of the map and away from the chunk edge
        let ax = -dx / (dPlayer + 1e-3), az = -dz / (dPlayer + 1e-3);
        if (herd) { const hx = herd.cx - a.position.x, hz = herd.cz - a.position.z, hd = Math.hypot(hx, hz) + 1e-3; if (hd > 25) { ax += hx / hd * 0.35; az += hz / hd * 0.35; } }
        this.steer(a, Math.atan2(ax, az), (boar ? BOAR_RUN : DEER_RUN) * (0.85 + 0.15 * Math.sin(a.seed * 9)), 3.5);
        a.lookWeight = 0;
        if (br.fleeT <= 0) { this.enter(a, br, 'idle'); br.timer = 1.5; }
        break;
      }
      case 'charge': {
        br.timer -= dt;
        this.steer(a, Math.atan2(dx, dz), BOAR_CHARGE, 4.0);
        a.lookTarget.copy(player); a.lookWeight = 0.5;
        if (dPlayer < 1.4) {
          this.onCharge?.(a, 25);
          this.onSound?.('boar_grunt', a.position);
          br.chargeCd = 6;
          this.enter(a, br, 'flee');
        } else if (br.timer <= 0) { br.chargeCd = 4; this.enter(a, br, 'flee'); }
        break;
      }
      default: break;
    }
    // keep every animal inside the chunk / off steep ground / out of trunks
    this.confine(a);
    if (herd) this.updateHerd(herd);
  }

  private enter(a: Animal, br: Brain, s: Animal['state']) {
    const rng = this.rng;
    a.state = s;
    switch (s) {
      case 'idle': br.timer = rng.range(3, 7); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'graze': br.timer = rng.range(6, 14); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'wander': {
        const herd = a.herd >= 0 ? this.herds[a.herd] : null;
        let ok = false;
        for (let i = 0; i < 12 && !ok; i++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(5, 25);
          let tx = a.position.x + Math.cos(ang) * r, tz = a.position.z + Math.sin(ang) * r;
          if (herd) { // stay within ~15 m of the herd centre
            const hx = tx - herd.cx, hz = tz - herd.cz, hd = Math.hypot(hx, hz);
            if (hd > 15) { tx = herd.cx + hx / hd * 14; tz = herd.cz + hz / hd * 14; }
          }
          if (!inChunk(tx, tz, 20) || normalAt(tx, tz)[1] < 0.78 || cabinMask(tx, tz) > 0) continue;
          if (this.forest.nearby(tx, tz, 1.0).length) continue;
          br.tx = tx; br.tz = tz; ok = true;
        }
        if (!ok) { a.state = 'idle'; br.timer = 2; break; }
        br.timer = rng.range(8, 20);
        break;
      }
      case 'alert':
        br.scared = rng.range(1.2, 3.5); br.timer = 2.5;
        a.setMotion(a.desiredYaw, 0, 2);
        if (a.kind === 'boar' && rng.next() < 0.5) this.onSound?.('boar_grunt', a.position);
        break;
      case 'flee':
        br.fleeT = rng.range(8, 12);
        if (a.kind === 'deer' && rng.next() < 0.3) this.onSound?.('deer_call', a.position);
        break;
      case 'charge':
        br.timer = 4;
        this.onSound?.('boar_grunt', a.position);
        break;
      default: break;
    }
  }

  /** desired heading with trunk repulsion, slope + edge avoidance */
  private steer(a: Animal, yaw: number, speed: number, turnRate: number) {
    let vx = Math.sin(yaw), vz = Math.cos(yaw);
    const px = a.position.x, pz = a.position.z;
    const look = 1.5 + speed * 0.45;
    for (const tr of this.forest.nearby(px + vx * look * 0.5, pz + vz * look * 0.5, look)) {
      const ox = px - tr.x, oz = pz - tr.z;
      const d = Math.hypot(ox, oz) + 1e-3;
      const range = tr.r + look;
      if (d < range) { const f = (1 - d / range) * 1.6; vx += ox / d * f; vz += oz / d * f; }
    }
    // steep ground ahead / chunk edge: bend toward the chunk centre
    const ax = px + vx * look, az = pz + vz * look;
    if (!inChunk(ax, az, 22) || normalAt(ax, az)[1] < 0.75) {
      const cd = Math.hypot(px, pz) + 1e-3;
      vx += -px / cd * 1.5; vz += -pz / cd * 1.5;
      // and try the perpendiculars
      const sx = -vz, sz = vx;
      const lOk = inChunk(px + sx * look, pz + sz * look, 22) && normalAt(px + sx * look, pz + sz * look)[1] >= 0.75;
      if (lOk) { vx += sx; vz += sz; } else { vx -= sx; vz -= sz; }
    }
    a.setMotion(Math.atan2(vx, vz), speed, turnRate);
  }

  private confine(a: Animal) {
    const p = a.position;
    const lim = CHUNK_HALF - 4; // hard clamp; steering keeps AI animals ≥ 20 m from the edge
    if (Math.abs(p.x) > lim) p.x = Math.sign(p.x) * lim;
    if (Math.abs(p.z) > lim) p.z = Math.sign(p.z) * lim;
    for (const tr of this.forest.nearby(p.x, p.z, 0.6)) {
      const ox = p.x - tr.x, oz = p.z - tr.z;
      const d = Math.hypot(ox, oz), min = tr.r + 0.45;
      if (d < min && d > 1e-4) { p.x = tr.x + ox / d * min; p.z = tr.z + oz / d * min; }
    }
  }

  private updateHerd(h: Herd) {
    let x = 0, z = 0, n = 0;
    for (const m of h.members) if (m.alive) { x += m.position.x; z += m.position.z; n++; }
    if (n) { h.cx += (x / n - h.cx) * 0.2; h.cz += (z / n - h.cz) * 0.2; }
  }

  // ── combat ─────────────────────────────────────────────────────────────────────────────

  private hitResult: AnimalHit = { animal: null as unknown as Animal, point: new THREE.Vector3(), distance: 0, headshot: false };

  /**
   * Ray vs every living animal's head sphere + body capsule. Returns the nearest hit
   * (the returned object is reused between calls — copy what you need).
   */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, aliveOnly = true): AnimalHit | null {
    let best = maxDist, bestA: Animal | null = null, bestHead = false;
    for (const a of this.animals) {
      if (aliveOnly && !a.alive) continue;
      // broad phase: bounding sphere around the animal
      _c.copy(a.position); _c.y += a.dims.bodyY * a.scale;
      _d.subVectors(_c, origin);
      const tca = _d.dot(dir);
      if (tca < -2 || tca > best + 2) continue;
      const bR = (a.dims.bodyHalfLen + 1.2) * a.scale;
      if (_d.lengthSq() - tca * tca > bR * bR) continue;
      // head
      a.headWorld(_p);
      const th = raySphere(origin, dir, _p, a.dims.headRadius * a.scale);
      if (th >= 0 && th < best) { best = th; bestA = a; bestHead = true; }
      // body capsule
      a.bodyCapsule(_a, _b);
      const tb = rayCapsule(origin, dir, _a, _b, a.dims.bodyRadius * a.scale);
      if (tb >= 0 && tb < best) { best = tb; bestA = a; bestHead = false; }
    }
    if (!bestA) return null;
    const h = this.hitResult;
    h.animal = bestA; h.distance = best; h.headshot = bestHead;
    h.point.copy(origin).addScaledVector(dir, best);
    return h;
  }

  /** Apply a hit: damage (×3 for headshots), blood, sounds and the kill event. Returns true if it died. */
  hit(hit: AnimalHit, damage: number, dir: THREE.Vector3): boolean {
    const a = hit.animal;
    const dmg = hit.headshot ? damage * 3 : damage;
    this.blood.burst(hit.point, dir, hit.headshot ? 1.4 : 1);
    if (a.kind === 'boar') this.onSound?.('boar_squeal', a.position); else this.onSound?.('deer_call', a.position);
    const died = a.applyDamage(dmg, hit.point, dir);
    const br = this.brains.get(a);
    if (died) { this.onKill?.(a); if (br) br.timer = 0; }
    else if (br && a.state !== 'charge') {
      // a wounded animal bolts (boars may turn on you)
      if (a.kind === 'boar' && this.playerPos.distanceTo(a.position) < CHARGE_DIST + 2 && br.chargeCd <= 0 && this.rng.next() < 0.7) this.enter(a, br, 'charge');
      else this.enter(a, br, 'flee');
    }
    return died;
  }

  // ── debug ──────────────────────────────────────────────────────────────────────────────

  private updateDebug() {
    if (!this.debugMeshes.length) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, wireframe: true });
      for (const a of this.animals) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(a.dims.headRadius * a.scale, 10, 8), mat);
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(a.dims.bodyRadius * a.scale, a.dims.bodyHalfLen * 2 * a.scale, 4, 10), mat);
        this.debugMeshes.push(h, b); this.group.add(h, b);
      }
    }
    this.animals.forEach((a, i) => {
      const h = this.debugMeshes[i * 2], b = this.debugMeshes[i * 2 + 1];
      a.headWorld(h.position);
      a.bodyCapsule(_a, _b);
      b.position.lerpVectors(_a, _b, 0.5);
      _d.subVectors(_b, _a).normalize();
      b.quaternion.setFromUnitVectors(_c.set(0, 1, 0), _d);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Ray helpers
// ─────────────────────────────────────────────────────────────────────────────────────────

const _oc = new THREE.Vector3(), _ab = new THREE.Vector3(), _ao = new THREE.Vector3();

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number {
  _oc.subVectors(o, c);
  const b = _oc.dot(d), cc = _oc.dot(_oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : -1);
}

/** ray vs capsule (segment a-b, radius r): infinite-cylinder test clipped to the segment, plus the end spheres */
function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number): number {
  _ab.subVectors(b, a); _ao.subVectors(o, a);
  const abab = _ab.dot(_ab), abd = _ab.dot(d), abao = _ab.dot(_ao), aod = _ao.dot(d), aoao = _ao.dot(_ao);
  const A = abab - abd * abd, B = abab * aod - abao * abd, C = abab * (aoao - r * r) - abao * abao;
  let best = -1;
  if (A > 1e-6) {
    const disc = B * B - A * C;
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / A;
      if (t >= 0) {
        const y = abao + t * abd;
        if (y >= 0 && y <= abab) best = t;
      }
    }
  }
  const ta = raySphere(o, d, a, r), tb = raySphere(o, d, b, r);
  if (ta >= 0 && (best < 0 || ta < best)) best = ta;
  if (tb >= 0 && (best < 0 || tb < best)) best = tb;
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Blood: a pooled particle burst + pooled ground decals
// ─────────────────────────────────────────────────────────────────────────────────────────

function makeDropTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.7, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const MAX_P = 384, MAX_DECALS = 24;

class BloodFX {
  group = new THREE.Group();
  private pos = new Float32Array(MAX_P * 3);
  private vel = new Float32Array(MAX_P * 3);
  private life = new Float32Array(MAX_P);
  private points: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private next = 0;
  private decals: THREE.Mesh[] = [];
  private decalNext = 0;
  private active = 0;

  constructor(sky: Sky) {
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.09, 0.004, 0.003), size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, map: makeDropTexture(), alphaTest: 0.3 });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.group.add(this.points);
    for (let i = 0; i < MAX_P; i++) this.pos[i * 3 + 1] = -1000;
    const dmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.002, 0.002), roughness: 0.35, metalness: 0, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    sky.setupMaterial(dmat);
    const dgeo = new THREE.CircleGeometry(1, 18);
    // irregular splat outline
    const pa = dgeo.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < pa.count; i++) { const k = 0.6 + 0.4 * Math.abs(Math.sin(i * 7.3) * Math.cos(i * 3.1)); pa.setXY(i, pa.getX(i) * k, pa.getY(i) * k); }
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(dgeo, dmat);
      m.visible = false; m.receiveShadow = true; m.renderOrder = 2;
      this.decals.push(m); this.group.add(m);
    }
  }

  burst(at: THREE.Vector3, dir: THREE.Vector3, strength = 1) {
    const n = Math.round(22 * strength);
    for (let i = 0; i < n; i++) {
      const k = this.next; this.next = (this.next + 1) % MAX_P;
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
      // spray mostly along the shot direction (exit) with a wide cone
      const s = 1.5 + Math.random() * 3.5;
      this.vel[k * 3] = (dir.x * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      this.vel[k * 3 + 1] = (dir.y * 0.6 + (Math.random() - 0.2) * 1.2) * s;
      this.vel[k * 3 + 2] = (dir.z * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      this.life[k] = 0.45 + Math.random() * 0.45;
    }
    this.active = Math.min(MAX_P, this.active + n);
    // ground patch
    const d = this.decals[this.decalNext]; this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    const gx = at.x + dir.x * 0.4, gz = at.z + dir.z * 0.4;
    const gy = heightAt(gx, gz);
    const nrm = normalAt(gx, gz);
    d.position.set(gx, gy + 0.015, gz);
    _d.set(nrm[0], nrm[1], nrm[2]);
    d.quaternion.setFromUnitVectors(_c.set(0, 0, 1), _d);
    d.rotateZ(Math.random() * Math.PI * 2);
    const r = 0.14 + Math.random() * 0.14 * strength;
    d.scale.set(r, r * (0.7 + Math.random() * 0.5), 1);
    d.visible = true;
  }

  update(dt: number) {
    if (this.active === 0) return;
    let alive = 0;
    for (let k = 0; k < MAX_P; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -1000; continue; }
      alive++;
      this.vel[k * 3 + 1] -= 9.8 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
    }
    this.active = alive;
    this.posAttr.needsUpdate = true;
  }
}

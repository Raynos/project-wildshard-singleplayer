/**
 * Night play (PINE-HOLLOW-REMASTER PH-C7, Jake's PH-U9): the King's thralls roam the old-growth after dark and flee the
 * dawn — and the miller's errand (PH-C6): three of them stand in the millrace at night until you put them down.
 *
 *   ROAMERS   night > 0.55 and you in or near the old-growth (its ellipse × 1.6): up to 3 (phone) / 4 thralls — moss-grown elk and
 *             boar, the M2 'thrall' coat — are called up out of sight (≥ 45 m off you, never inside the King's clearing)
 *             and left to the herd AI (the boar charge, the elk hold their ground). When the night lifts (night < 0.35)
 *             each one turns and runs for the deep trees and is gone in a burst of fog. Past 230 m they are let go.
 *   MILLRACE  the miller asked (`errand:asked`), it is night, you are within 75 m of the mill: three thralls stand in the
 *             race by the wheel, heads down, listening. Within 20 m (or hit) they come for you. All three down →
 *             `errand:done`; the wheel turns again (Cabins.wheelSpeed, stopped until then).
 *
 * The thrall models are the King's (antlerKing.ts builds one of each kind at boot), so nothing here compiles mid-play.
 */
import * as THREE from 'three';
import type { Animal } from '../../entities/Animal';
import type { AnimalManager } from '../../entities/AnimalManager';
import { variantDef } from '../../entities/species/registry';
import { heightAt } from '../../world/Heightfield';
import { OLD_GROWTH, KINGS_CLEARING, HAMLET_SITES, POND } from '../../chunks/pineHollowLayout';
import { TIER } from '../../core/tier';
import { Puffs } from '../fxKit';
import { own, release, retire } from '../ctx';
import { headingTo } from '../combatMath';

const MOSS = new THREE.Color(0.5, 0.62, 0.42);
/** a thrall of `kind`: the creature lane's variant, else the moss-tinted stand-in the King's fight uses */
export function spawnThrall(animals: AnimalManager, kind: 'elk' | 'boar', x: number, z: number, yaw: number): Animal {
  const real = variantDef(kind, 'thrall').id === 'thrall';
  const a = animals.spawn(kind, x, z, yaw, real ? 'thrall' : kind === 'elk' ? 'bull' : 'black');
  if (!real) {
    a.label = 'Thrall';
    const m = Array.isArray(a.mesh.material) ? a.mesh.material[0] : a.mesh.material;
    if (m instanceof THREE.MeshStandardMaterial) m.color.multiply(MOSS);
  }
  return a;
}
/** is `a` one of the King's thralls (roaming, at the millrace or in his fight)? */
export function isThrall(a: { variant?: string; label?: string }): boolean { return a.variant === 'thrall' || a.label === 'Thrall'; }

const MAX = TIER === 'phone' ? 3 : 4;
const inGrowth = (x: number, z: number, k = 1): boolean => ((x - OLD_GROWTH.x) / (OLD_GROWTH.ax * k)) ** 2 + ((z - OLD_GROWTH.z) / (OLD_GROWTH.az * k)) ** 2 < 1;

export interface NightHost {
  animals: AnimalManager;
  scene: THREE.Scene;
  night: () => number;
  /** the miller's errand is on (asked, not done) */
  errand: () => boolean;
  onErrandDone: () => void;
  shot: (name: 'thrall_call' | 'thrall_groan' | 'thrall_move', at: THREE.Vector3) => void;
}

interface Roamer { a: Animal; flee: number }
interface Racer { a: Animal; woke: boolean }

/** where the millrace thralls stand: in the creek round the wheel */
const RACE: readonly [number, number][] = [[-189, -134], [-194, -148], [-198, -160]];

export class NightThralls {
  private roam: Roamer[] = [];
  private race: Racer[] = [];
  private acc = 0;
  private readonly puffs: Puffs;
  private readonly _v = new THREE.Vector3();

  constructor(private readonly h: NightHost) {
    this.puffs = new Puffs(h.scene, new THREE.Color(0.55, 0.7, 0.62), 3);
  }

  /** the roamers on the map now (dev / captures) */
  get count(): number { return this.roam.length + this.race.length; }

  /** dev / captures: call the roamers now, around `p`, and the millrace's */
  force(p: THREE.Vector3): void {
    for (let i = this.roam.length; i < MAX; i++) this.callRoamer(p, true);
    if (this.h.errand() && this.race.length === 0) this.callRace();
  }

  update(dt: number, t: number, p: THREE.Vector3): void {
    this.puffs.update(dt, t);
    const night = this.h.night();
    // the dawn: every roamer runs for the deep trees and is gone
    for (const r of this.roam) {
      if (!r.a.alive) continue;
      if (r.flee > 0) {
        r.flee += dt;
        r.a.setMotion(headingTo(p.x, p.z, r.a.position.x, r.a.position.z), 8, 3);
        if (r.flee > 3.5) { this.burst(r.a); retire(this.h.animals, r.a); r.flee = -1; }
      } else if (night < 0.35) { own(r.a); r.flee = 0.01; this.h.shot('thrall_move', r.a.position); }
    }
    this.roam = this.roam.filter((r) => r.flee >= 0 && r.a.alive);
    // the millrace: they stand listening until you come close or hit one
    for (const r of this.race) {
      const a = r.a;
      if (!a.alive || r.woke) continue;
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      a.setMotion(headingTo(a.position.x, a.position.z, HAMLET_SITES.wheel.x, HAMLET_SITES.wheel.z), 0, 1.5);
      a.lookWeight = 0;
      if (d < 20 || a.hp < a.maxHp) { r.woke = true; release(a); this.h.shot('thrall_groan', a.position); }
    }
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc = 0;
    // the millrace: all three down → the errand is done
    if (this.race.length > 0) {
      if (this.race.every((r) => !r.a.alive)) { this.race = []; this.h.onErrandDone(); }
    } else if (this.h.errand() && night > 0.5 && Math.hypot(p.x - HAMLET_SITES.mill.x, p.z - HAMLET_SITES.mill.z) < 75) this.callRace();
    // the roamers: called at night near the old-growth, let go when you are far
    const near = inGrowth(p.x, p.z, 1.6);
    for (const r of this.roam) if (r.a.alive && r.flee === 0 && Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z) > 230) { retire(this.h.animals, r.a); r.flee = -1; }
    this.roam = this.roam.filter((r) => r.flee >= 0 && r.a.alive);
    if (night > 0.55 && near && this.roam.length < MAX) this.callRoamer(p, false);
  }

  private callRoamer(p: THREE.Vector3, anywhere: boolean): void {
    for (let tries = 0; tries < 12; tries++) {
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.8;
      const x = OLD_GROWTH.x + Math.sin(ang) * OLD_GROWTH.ax * rr, z = OLD_GROWTH.z + Math.cos(ang) * OLD_GROWTH.az * rr;
      const dp = Math.hypot(x - p.x, z - p.z);
      if (!anywhere && (dp < 45 || dp > 150)) continue;
      if (anywhere && (dp < 18 || dp > 60)) continue;
      if (Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z) < KINGS_CLEARING.blend + 8) continue;
      if (Math.abs(x) > 235 || Math.abs(z) > 235 || heightAt(x, z) < POND.level + 0.6) continue;
      const kind = this.roam.length % 2 === 0 ? 'elk' : 'boar';
      const a = spawnThrall(this.h.animals, kind, x, z, headingTo(x, z, p.x, p.z));
      this.roam.push({ a, flee: 0 });
      this.h.shot('thrall_call', a.position);
      return;
    }
  }

  private callRace(): void {
    RACE.forEach(([x, z], i) => {
      const a = spawnThrall(this.h.animals, i === 1 ? 'elk' : 'boar', x, z, headingTo(x, z, HAMLET_SITES.wheel.x, HAMLET_SITES.wheel.z));
      own(a);
      this.race.push({ a, woke: false });
    });
  }

  private burst(a: Animal): void { this.puffs.burst(this._v.copy(a.position).setY(a.position.y + 1), 1.2, 3.4, 0.8, 0.8); }
}

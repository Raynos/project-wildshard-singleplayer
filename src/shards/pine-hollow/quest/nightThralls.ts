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
import { NightBrain } from './nightBrain';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { variantDef } from '@wildshard/engine/entities/species/registry';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { pineNightSpec } from './nightSpec';
import { Puffs } from '../combat/fxKit';
import { own, release, retire } from '../combat/ctx';
import { thrallSpawner, spawnThrallFrom } from '../combat/spawns';

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

const MAX = TIER === 'phone' ? 3 : 4;

export interface NightHost {
  animals: AnimalManager;
  scene: THREE.Scene;
  night: () => number;
  /** the miller's errand is on (asked, not done) */
  errand: () => boolean;
  onErrandDone: () => void;
  shot: (name: 'thrall_call' | 'thrall_groan' | 'thrall_move', at: THREE.Vector3) => void;
}

export class NightThralls {
  private readonly brain: NightBrain<Animal>;
  private readonly puffs: Puffs;
  private readonly point = new THREE.Vector3();
  constructor(h: NightHost) {
    const spawner = thrallSpawner(h.animals, (kind, x, z, yaw) => spawnThrall(h.animals, kind, x, z, yaw));
    this.puffs = new Puffs(h.scene, new THREE.Color(0.55, 0.7, 0.62), 3);
    this.brain = new NightBrain<Animal>({
      night: h.night, errand: h.errand, onErrandDone: h.onErrandDone, next: Math.random, height: heightAt,
      shot: (name, actor) => { h.shot(name, actor.position); },
      spawn: (kind, x, z, yaw) => spawnThrallFrom(spawner, kind === 'elk' ? 'elk' : 'boar', x, z, yaw,
        () => spawnThrall(h.animals, kind === 'elk' ? 'elk' : 'boar', x, z, yaw)), own, release,
      retire: (actor) => { if (spawner === null) retire(h.animals, actor); else spawner.retire(actor); },
      burst: (actor) => { this.puffs.burst(this.point.copy(actor.position).setY(actor.position.y + 1), 1.2, 3.4, 0.8, 0.8); },
    }, pineNightSpec(MAX));
  }
  get count(): number { return this.brain.count; }
  force(p: THREE.Vector3): void { this.brain.force(p); }
  update(dt: number, t: number, p: THREE.Vector3): void { this.puffs.update(dt, t); this.brain.update(dt, p); }
}

/**
 * Quest beat 5 (PINE-HOLLOW-REMASTER PH-C1): "follow the Ghost Stag to the old-growth" — a scripted lead. After dark a
 * pale stag stands on the west road where it leaves the Hollow, staring back at you. Come within ~16 m and it turns,
 * trots a few strides on and fades in a pale burst; it is waiting again at the next bend, staring. Six bends down the
 * west road and through the stones' gap, it fades for good in the King's clearing (`followed:stag`).
 *
 * The apparition is the Ghost Stag's own coat (deer 'ghost', built at boot for the elite, so nothing compiles) but NOT
 * the elite: it is spawned and at once taken out of the manager's list — no hitbox, no aim assist, no minimap dot, no
 * kill to count — and driven from here (its gait from Animal.update). The elite at its lair is untouched.
 */
import * as THREE from 'three';
import type { Animal } from '../../entities/Animal';
import type { AnimalManager } from '../../entities/AnimalManager';
import { Puffs } from '../fxKit';
import { headingTo } from '../combatMath';
import { voice } from '../ctx';

/** the west road out of the Hollow, its bend into the clearing, the stones' gap, inside the ring */
export const STAG_PATH: readonly [number, number][] = [[30, -2], [58, 12], [86, 16], [120, 12], [158, 6], [155, -6], [151, -18]];
const NEAR = 16, TROT = 1.3, GONE = 1.1;

export class StagLead {
  private a: Animal | null = null;
  private i = 0;
  private mode: 'none' | 'stare' | 'trot' | 'gone' = 'none';
  private t = 0;
  private readonly puffs: Puffs;
  private readonly _v = new THREE.Vector3();
  onDone?: () => void;
  onAppear?: (first: boolean) => void;

  constructor(scene: THREE.Scene, private readonly animals: AnimalManager) {
    this.puffs = new Puffs(scene, new THREE.Color(0.75, 1.6, 2.0), 3);
  }

  get active(): boolean { return this.a !== null; }
  /** where the apparition stands (null: not out) — the dawn fog closes round it (PH-C7, src/pinehollow/weather.ts) */
  get position(): THREE.Vector3 | null { return this.a?.position ?? null; }

  /** per frame. `on` = the beat is current and it is night; off → the apparition leaves (a burst) */
  update(dt: number, t: number, on: boolean, player: THREE.Vector3): void {
    this.puffs.update(dt, t);
    if (!on) { if (this.a) this.vanish(false); this.i = 0; this.mode = 'none'; return; }
    const first = STAG_PATH[0];
    if (!this.a) {
      if (first === undefined || Math.hypot(player.x - first[0], player.z - first[1]) > 70) return;
      this.appear(0, player, true);
    }
    const a = this.a;
    if (!a) return;
    this.t += dt;
    a.update(dt, t, true);
    if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) a.sampleTerrain();
    const d = Math.hypot(player.x - a.position.x, player.z - a.position.z);
    if (this.mode === 'stare') {
      a.setMotion(headingTo(a.position.x, a.position.z, player.x, player.z), 0, 3);
      a.lookTarget.copy(player); a.lookWeight = 1;
      // you came near — or ran past it along the road (you are nearer the clearing than it is): it moves on
      const end = STAG_PATH[STAG_PATH.length - 1];
      const past = end !== undefined && Math.hypot(player.x - end[0], player.z - end[1]) + 4 < Math.hypot(a.position.x - end[0], a.position.z - end[1]);
      if (d < NEAR || past) { this.mode = 'trot'; this.t = 0; }
    } else if (this.mode === 'trot') {
      const next = STAG_PATH[this.i + 1] ?? STAG_PATH[this.i];
      if (next) a.setMotion(headingTo(a.position.x, a.position.z, next[0], next[1]), 4.5, 4);
      a.lookWeight = 0;
      if (this.t > TROT) this.fade();
    } else if (this.mode === 'gone' && this.t > GONE) {
      this.appear(this.i, player, false);
    }
  }

  private spawnAt(x: number, z: number, yaw: number): Animal {
    const a = this.animals.spawn('deer', x, z, yaw, 'ghost');
    // out of the manager's hands: its list is the hitbox / aim assist / minimap / AI
    const k = this.animals.animals.indexOf(a); if (k !== -1) this.animals.animals.splice(k, 1);
    a.herd = -1; a.setDrawLod(0);
    return a;
  }

  private appear(i: number, player: THREE.Vector3, first: boolean): void {
    const p = STAG_PATH[i];
    if (!p) return;
    const yaw = headingTo(p[0], p[1], player.x, player.z);
    if (this.a) { this.a.place(p[0], p[1], yaw); this.a.mesh.visible = true; } else this.a = this.spawnAt(p[0], p[1], yaw);
    this.a.sampleTerrain();
    this.i = i; this.mode = 'stare'; this.t = 0;
    this.puffs.burst(this._v.copy(this.a.position).setY(this.a.position.y + 1.1), 2.6, 0.7, 0.55, 0.7);
    this.onAppear?.(first);
  }

  private fade(): void {
    const a = this.a; if (!a) return;
    this.puffs.burst(this._v.copy(a.position).setY(a.position.y + 1.1), 0.6, 3.2, 0.7, 0.95);
    voice(this.animals, 'deer_call', a.position);
    a.mesh.visible = false; a.setMotion(a.yaw, 0, 1);
    if (this.i + 1 >= STAG_PATH.length) { this.vanish(true); return; }
    this.i++; this.mode = 'gone'; this.t = 0;
  }

  /** gone for good: out of the scene (done = it reached the clearing) */
  private vanish(done: boolean): void {
    const a = this.a; if (!a) return;
    if (a.mesh.visible) this.puffs.burst(this._v.copy(a.position).setY(a.position.y + 1.1), 0.6, 3.2, 0.7, 0.95);
    a.alive = false; a.hidden = true; a.mesh.visible = false; a.mesh.removeFromParent();
    this.a = null; this.mode = 'none';
    if (done) this.onDone?.();
  }
}

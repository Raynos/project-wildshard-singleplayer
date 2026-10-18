import type { PineQuestRows } from '../runtime/productSections.generated.d.ts';
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
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { Puffs } from '../runtime/combat/fxKit';
import type { QuestChapter } from '@wildshard/game/quest/chapter';

// AS decides at <=10 Hz; Animal integrates the borrowed motion every frame.
type StagBody = Pick<Animal, 'position' | 'yaw' | 'herd' | 'setDrawLod' | 'update' | 'sampleTerrain' | 'setMotion' | 'lookTarget' | 'lookWeight' | 'place' | 'mesh' | 'alive' | 'hidden'>;

export class StagLead {
  private a: StagBody | null = null;
  private pending = 0;
  private readonly walk = { i: 0, mode: 0, elapsed: 0 };
  private readonly puffs: Puffs;
  private readonly _v = new THREE.Vector3();
  onDone?: () => void;
  onAppear?: (first: boolean) => void;

  constructor(scene: THREE.Scene, private readonly animals: { animals: StagBody[]; spawn: (kind: 'deer', x: number, z: number, yaw: number, variant: 'ghost') => StagBody; onSound?: (name: string, at: THREE.Vector3) => void }, private readonly rows: PineQuestRows['lead'], private readonly chapter: Pick<QuestChapter, 'project'>) {
    this.puffs = new Puffs(scene, new THREE.Color(0.75, 1.6, 2.0), 3);
  }

  get active(): boolean { return this.a !== null; }
  /** where the apparition stands (null: not out) — the dawn fog closes round it (PH-C7, src/shards/pine-hollow/world/weather.ts) */
  get position(): THREE.Vector3 | null { return this.a?.position ?? null; }

  /** per frame. `on` = the beat is current and it is night; off → the apparition leaves (a burst) */
  update(dt: number, t: number, on: boolean, player: THREE.Vector3): void {
    this.puffs.update(dt, t);
    this.pending += dt;
    if (this.pending >= 0.1) {
      const point = this.rows.path[this.walk.i], at = this.a?.position;
      const result = this.chapter.project('lead', { ...this.walk, begin: 0, dt: this.pending, on: Number(on),
        playerX: player.x, playerZ: player.z, atX: at?.x ?? point?.[0] ?? 0, atZ: at?.z ?? point?.[1] ?? 0 });
      Object.assign(this.walk, result);
      const event = result['event'];
      if (event === undefined) throw new Error('Stag projection omitted its event');
      this.pending = 0;
      if (event === 4) this.vanish(false);
      else if (event === 1 || event === 2) this.appear(this.walk.i, player, event === 1);
      else if (event !== 0) { this.fade(); if (event === 5) this.vanish(true); }
    }
    const a = this.a;
    if (!a) return;
    a.update(dt, t, true);
    if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) a.sampleTerrain();
    if (this.walk.mode === 1) {
      a.setMotion(Math.atan2(player.x - a.position.x, player.z - a.position.z), 0, 3);
      a.lookTarget.copy(player); a.lookWeight = 1;
    } else if (this.walk.mode === 2) {
      const next = this.rows.path[this.walk.i + 1] ?? this.rows.path[this.walk.i];
      if (next) a.setMotion(Math.atan2(next[0] - a.position.x, next[1] - a.position.z), 4.5, 4);
      a.lookWeight = 0;
    }
  }

  private spawnAt(x: number, z: number, yaw: number): StagBody {
    const a = this.animals.spawn('deer', x, z, yaw, 'ghost');
    // out of the manager's hands: its list is the hitbox / aim assist / minimap / AI
    const k = this.animals.animals.indexOf(a); if (k !== -1) this.animals.animals.splice(k, 1);
    a.herd = -1; a.setDrawLod(0);
    return a;
  }

  private appear(i: number, player: THREE.Vector3, first: boolean): void {
    const p = this.rows.path[i];
    if (!p) return;
    const yaw = Math.atan2(player.x - p[0], player.z - p[1]);
    if (this.a) { this.a.place(p[0], p[1], yaw); this.a.mesh.visible = true; } else this.a = this.spawnAt(p[0], p[1], yaw);
    this.a.sampleTerrain();
    this.puffs.burst(this._v.copy(this.a.position).setY(this.a.position.y + 1.1), 2.6, 0.7, 0.55, 0.7);
    this.onAppear?.(first);
  }

  private fade(): void {
    const a = this.a; if (!a) return;
    this.puffs.burst(this._v.copy(a.position).setY(a.position.y + 1.1), 0.6, 3.2, 0.7, 0.95);
    this.animals.onSound?.('deer_call', a.position);
    a.mesh.visible = false; a.setMotion(a.yaw, 0, 1);
  }

  /** gone for good: out of the scene (done = it reached the clearing) */
  private vanish(done: boolean): void {
    const a = this.a; if (!a) return;
    if (a.mesh.visible) this.puffs.burst(this._v.copy(a.position).setY(a.position.y + 1.1), 0.6, 3.2, 0.7, 0.95);
    a.alive = false; a.hidden = true; a.mesh.visible = false; a.mesh.removeFromParent();
    this.a = null;
    if (done) this.onDone?.();
  }
}

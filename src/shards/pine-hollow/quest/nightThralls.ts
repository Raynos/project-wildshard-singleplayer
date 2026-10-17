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
import { SpawnScript } from '@wildshard/game/population/spawnScript';
import { TIER } from '@wildshard/engine/core/tier';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { Puffs } from '../runtime/combat/fxKit';

export interface NightHost {
  animals: AnimalManager; scene: THREE.Scene; night: () => number;
  errand: () => boolean; onErrandDone: () => void;
  shot: (name: string, at: THREE.Vector3) => void;
}
/** Client presentation for the AS-owned night encounter. */
export class NightThralls {
  private readonly brain: SpawnScript;
  private readonly puffs: Puffs;
  private readonly point = new THREE.Vector3();
  private readonly flags: string[] = [];
  constructor(private readonly h: NightHost, rows: unknown) {
    this.puffs = new Puffs(h.scene, new THREE.Color(0.55, 0.7, 0.62), 3);
    this.brain = SpawnScript.page(h.animals, rows);
  }
  private present(): void {
    if (this.brain.hasFlag('errand:done') && this.h.errand()) this.h.onErrandDone();
    for (const effect of this.brain.drainEffects()) {
      if (effect.kind !== 'cue') continue;
      if (effect.id === 4) this.puffs.burst(this.point.copy(effect.at).setY(effect.at.y + 1), 1.2, 3.4, 0.8, 0.8);
      else {
        const name = ['thrall_call', 'thrall_groan', 'thrall_move'][effect.id - 1];
        if (name !== undefined) this.h.shot(name, this.point.copy(effect.at));
      }
    }
  }
  get count(): number { return this.brain.channel(1); }
  force(point: THREE.Vector3): void { this.point.copy(point); this.brain.force(); }
  update(dt: number, t: number, point: THREE.Vector3): void {
    this.puffs.update(dt, t); this.flags.length = 0; if (this.h.errand()) this.flags.push('errand:asked');
    this.brain.advance(dt, point, this.h.night(), TIER === 'phone' ? 3 : 4, this.flags); this.present();
  }
}

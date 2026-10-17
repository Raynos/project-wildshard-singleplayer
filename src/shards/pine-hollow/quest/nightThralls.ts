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
import { PagePopulationWaves } from '@wildshard/sdk/populationPageWaves';
import type { DirectorLane } from '@wildshard/game/plugin/director';
import { TIER } from '@wildshard/engine/core/tier';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { Puffs } from '../runtime/combat/fxKit';

export interface NightHost {
  animals: AnimalManager; scene: THREE.Scene; night: () => number;
  errand: () => boolean; onErrandDone: () => void;
  shot: (name: string, at: THREE.Vector3) => void;
}
/** The shard's puff/sound presentation; population ownership and spawning are shared game mechanics. */
export class NightThralls {
  private readonly brain: InstanceType<typeof PagePopulationWaves>;
  private readonly puffs: Puffs;
  private readonly point = new THREE.Vector3();
  constructor(private readonly h: NightHost, lane: DirectorLane, rows: unknown) {
    this.puffs = new Puffs(h.scene, new THREE.Color(0.55, 0.7, 0.62), 3);
    this.brain = new PagePopulationWaves(lane, h.animals, rows, TIER === 'phone' ? 3 : 4);
  }
  private present(): void {
    for (const effect of this.brain.effects()) {
      if (effect.kind === 'complete') this.h.onErrandDone();
      else if (effect.kind === 'voice') this.h.shot(effect.name, effect.at);
      else this.puffs.burst(this.point.copy(effect.at).setY(effect.at.y + 1), 1.2, 3.4, 0.8, 0.8);
    }
  }
  get count(): number { return this.brain.count; }
  force(point: THREE.Vector3): void { this.brain.force(point, this.h.errand()); this.present(); }
  update(dt: number, t: number, point: THREE.Vector3): void {
    this.puffs.update(dt, t); this.brain.advance(dt, point, this.h.night(), this.h.errand()); this.present();
  }
}

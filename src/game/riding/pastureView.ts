import { app } from '@wildshard/engine/app/runtime';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { GameServices } from '../plugin/context';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Vector3 } from 'three';
import type { CrowdTargets } from '../shardfile/crowdRuntime';
import type { PageWildlife } from '../population/wildlife';
import { PagePastureRaid } from './pagePasture';
import type { MountedFigure } from './mountedFigure';

/** Client-only cue projection of the native pasture owner, with the baseline
 * HUD and sound authorities. Mounted figures use admitted scene/clip rows. */
export class PastureView<T extends CrowdTargets> extends PagePastureRaid<T> {
  constructor(private readonly game: GameServices, private readonly animals: AnimalManager,
    private readonly population: PageWildlife<T>, private readonly figure: MountedFigure) {
    super(animals, population, population.pastureProfile);
    if (this.shepherd !== null) figure.attach(this.shepherd);
  }
  override update(dt: number, player: Vector3): void {
    super.update(dt, player, this.population.predators, app.clock.now, practiceRoom.open);
    for (let i = 0; i < 8; i++) {
      const cue = this.nextCue(); if (cue === undefined) break;
      this.figure.cue(cue.kind);
      if (cue.text !== '') this.game.runtime?.play?.hud.toast(cue.text);
      const actor = this.animals.animals.find(body => body.entityId === cue.actor);
      if (cue.sound !== null && actor !== undefined) this.animals.onSound?.(cue.sound, actor.position);
    }
    if (this.shepherd !== null) this.figure.update(dt, this.shepherd.speed);
  }
}

import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { PageWildlife } from '../population/wildlife';
import type { CrowdTargets } from '../shardfile/crowdRuntime';
import { PastureActorSchema } from '@wildshard/format/wildlifePopulation';
import { NativePastureRaid } from './pastureController';
import { PastureCues, type PastureCue } from './pastureCues';
/** Client-only entry to the same native pasture controller. Only concrete
 * manager/population authorities and actor/cue rows cross the boundary. */
export class PagePastureRaid<T extends CrowdTargets> extends NativePastureRaid<Animal,PackBrain<Animal>> {
  private readonly cues: PastureCues;
  constructor(animals: AnimalManager,population: PageWildlife<T>,input: unknown) {
    const rows = v.parse(PastureActorSchema,input),cues = new PastureCues(rows.cues);
    if (!(population instanceof PageWildlife)) throw new Error('Missing page population owner');
    const flock = population.flocks[0] ?? null,random = app.rng.stream('ai'),program = population.pastureAuthor;
    const delay = program.project('raidFirst',{},random)['raidT'] ?? 0;
    const site = program.project('shepherdSite',{ cx: flock?.cx ?? 10000,cz: flock?.cz ?? 10000 });
    const shepherd = site['accept'] === 1 ? animals.spawn(rows.kind,site['x'] ?? 0,site['z'] ?? 0,site['yaw'] ?? 0,rows.variant) : null;
    if (shepherd !== null) { shepherd.mem['owned'] = 1; shepherd.label = rows.label; }
    super(program,random,shepherd,flock,population.packs,index => { if (flock === null) throw new Error('Missing raid crowd'); return flock.prey(index); },
      (x,z,variants) => population.spawnPack(x,z,variants),delay,rows.raiders,cues.sink);
    this.cues = cues;
  }
  /** Read and retire one ordinary presentation cue; restore emits nothing. */
  nextCue(): PastureCue | undefined { return this.cues.next(); }
}



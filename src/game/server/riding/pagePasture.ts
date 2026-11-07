import * as v from 'valibot';
import type { Rng } from '@wildshard/engine/core/rng';
import type { RowBodiesView } from '@wildshard/engine/entities/RowBodies';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { PageWildlife } from '../population/wildlife';
import type { CrowdTargets } from '../../shared/shardfile/crowdRuntime';
import { PastureActorSchema } from '@wildshard/format/wildlifePopulation';
import { NativePastureRaid } from './pastureController';
import { PastureCues, type PastureCue } from '../../shared/riding/pastureCues';
/** Client-only entry to the same native pasture controller. Only concrete
 * manager/population authorities and actor/cue rows cross the boundary. */
export class PagePastureRaid<T extends CrowdTargets> extends NativePastureRaid<Animal,PackBrain<Animal>> {
  private readonly cues: PastureCues;
  private readonly rows: boolean;
  constructor(animals: RowBodiesView,population: PageWildlife<T>,input: unknown,random: Rng) {
    const rows = v.parse(PastureActorSchema,input),cues = new PastureCues(rows.cues);
    const flock = population.flocks[0] ?? null,program = population.pastureAuthor;
    const delay = program.project('raidFirst',{},random)['raidT'] ?? 0;
    const site = program.project('shepherdSite',{ cx: flock?.cx ?? 10000,cz: flock?.cz ?? 10000 });
    const shepherd = site['accept'] === 1 && !population.rowBodies ? animals.spawn(rows.kind,site['x'] ?? 0,site['z'] ?? 0,site['yaw'] ?? 0,rows.variant) : null;
    if (shepherd !== null) { shepherd.mem['owned'] = 1; shepherd.label = rows.label; }
    super(program,random,shepherd,flock,population.packs,index => { if (flock === null) throw new Error('Missing raid crowd'); return flock.prey(index); },
      (x,z,variants) => population.spawnPack(x,z,variants),delay,rows.raiders,cues.sink);
    this.cues = cues; this.rows = population.rowBodies;
  }
  /** On a server its raid runs there, and reaches this page as rows. */
  override update(...input: Parameters<NativePastureRaid<Animal,PackBrain<Animal>>['update']>): void { if (!this.rows) super.update(...input); }
  /** Read and retire one ordinary presentation cue; restore emits nothing. */
  nextCue(): PastureCue | undefined { return this.cues.next(); }
}



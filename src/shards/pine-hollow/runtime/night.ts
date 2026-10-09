import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';
import { NightBrain } from '../quest/nightBrain';
import { pineNightSpec } from '../quest/nightSpec';
import type { PineHuntBody } from './roster';

export const NIGHT_STEP = 'pine.night';
const uint = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const Saved = v.strictObject({ version: v.literal(1), population: v.unknown(),
  rng: v.strictObject({ version: v.literal(1), state: uint, initial: uint, scrambledFork: v.literal(false) }) });
export interface PineNightPorts {
  readonly night: () => number;
  readonly heightAt: (x: number, z: number) => number;
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  readonly retire: (actor: PineHuntBody) => void;
  readonly find: (id: string) => PineHuntBody | null;
  /** A native phone installation uses three roamers; desktop can explicitly request four. */
  readonly max?: 3 | 4;
}

/** The shipping population law on actual roster actors. Placement uses a dedicated saved native stream; the page's
 * Math.random placement source and variable render-frame cadence remain separate compatibility inputs, not an oracle.
 * Install after the quest clock and before the roster callback; ports are resolved only at update/restore time. */
export function installPineNight(host: SimHost, ports: PineNightPorts): NightBrain<PineHuntBody> {
  let rng = new Rng(host.level.seed).fork(NIGHT_STEP);
  const initial = rng.snapshot().initial;
  const brain = new NightBrain<PineHuntBody>({ night: ports.night,
    errand: () => host.flags.has('errand:asked') && !host.flags.has('errand:done'),
    onErrandDone: () => { host.flags.set('errand:done'); }, next: () => rng.next(), height: ports.heightAt,
    spawn: (kind, x, z, yaw) => ports.spawn(kind, x, z, yaw, 'thrall'), retire: ports.retire,
    own: actor => { actor.herd = -1; actor.state = 'sidestep'; actor.scripted = true; },
    release: actor => { actor.scripted = false; if (actor.alive && actor.state === 'sidestep') actor.state = 'alert'; },
    shot: () => undefined, burst: () => undefined,
  }, pineNightSpec(ports.max ?? 3));
  host.onStep(NIGHT_STEP, dt => { brain.update(dt, host.player.position); }, {
    snapshot: () => ({ version: 1, population: brain.snapshot(actor => actor.entityId), rng: { ...rng.snapshot() } }),
    restore: value => {
      const saved = v.parse(Saved, value), next = new Rng(host.level.seed).fork(NIGHT_STEP);
      if (saved.rng.initial !== initial) throw new RangeError('Incompatible Pine night stream');
      next.restore(saved.rng);
      const commit = brain.prepareRestore(saved.population, id => {
        const actor = ports.find(id);
        if (actor !== null && (actor.variant !== 'thrall' || (actor.kind !== 'elk' && actor.kind !== 'boar'))) throw new RangeError('Incompatible Pine night actor');
        return actor;
      });
      commit(); rng = next;
    },
  });
  return brain;
}

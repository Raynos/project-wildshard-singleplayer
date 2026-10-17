import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { DirectorLane } from '../plugin/director';
import type { NativePopulationActor } from './roster';
import { parsePopulationWaves } from '@wildshard/format/populationWaves';
import { PopulationWaveDirector } from './waves';

const uint = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const Saved = v.strictObject({ version: v.literal(1), population: v.unknown(),
  rng: v.strictObject({ version: v.literal(1), state: uint, initial: uint, scrambledFork: v.literal(false) }) });
/** The existing native clock, ground and actor roster, resolved by the admitted assembly. */
export interface NativePopulationWavePorts {
  readonly night: () => number;
  readonly heightAt: (x: number, z: number) => number;
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => NativePopulationActor;
  readonly retire: (actor: NativePopulationActor) => void;
  readonly find: (id: string) => NativePopulationActor | null;
  readonly max?: number;
}
/** Install data-authored waves on the existing native roster, preserving its v1 embedded population/RNG wire. */
export function installNativePopulationWaves(host: SimHost, lane: DirectorLane, ports: NativePopulationWavePorts, input: unknown): PopulationWaveDirector<NativePopulationActor> {
  const rows = parsePopulationWaves(input);
  const { rule } = rows, scripted = v.parse(v.picklist(ANIMAL_STATES), rule.state);
  let rng = new Rng(host.level.seed).fork(rule.step);
  const initial = rng.snapshot().initial;
  const brain = new PopulationWaveDirector<NativePopulationActor>(lane, { night: ports.night,
    errand: () => host.flags.has(rule.asked) && !host.flags.has(rule.done),
    onErrandDone: () => { host.flags.set(rule.done); }, stream: { next: () => rng.next() }, ground: { heightAt: ports.heightAt },
    spawn: (kind, x, z, yaw) => ports.spawn(kind, x, z, yaw, rule.variant), retire: ports.retire,
    own: actor => { actor.herd = -1; actor.state = scripted; actor.scripted = true; },
    release: actor => { actor.scripted = false; if (actor.alive && actor.state === scripted) actor.state = 'alert'; },
    shot: () => undefined, burst: () => undefined,
  }, { ...rows.spec, max: ports.max ?? rows.spec.max }, rows.stages, rows.tuning);
  host.onStep(rule.step, dt => { brain.advance(dt, host.player.position); }, {
    snapshot: () => ({ version: 1, population: brain.snapshot(actor => actor.entityId), rng: { ...rng.snapshot() } }),
    restore: value => {
      const saved = v.parse(Saved, value), next = new Rng(host.level.seed).fork(rule.step);
      if (saved.rng.initial !== initial) throw new RangeError('Incompatible population placement stream');
      next.restore(saved.rng);
      const kinds = new Set([...rows.spec.roamKinds, ...rows.spec.race.map(row => row.kind)]);
      const commit = brain.prepareRestore(saved.population, id => {
        const actor = ports.find(id);
        if (actor !== null && (actor.variant !== rule.variant || !kinds.has(actor.kind))) throw new RangeError('Incompatible population wave actor');
        return actor;
      });
      commit(); rng = next;
    },
  });
  return brain;
}

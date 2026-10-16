import { DirectorScriptStageLane, prepareDirectorModule, type DirectorLane } from '@wildshard/game/plugin/director';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import stages from '../data/finaleStages.json' with { type: 'json' };
import { parseDirector } from '@wildshard/format/director';
import declaration from '../data/director.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };

/** The same immutable admitted bytes for page and worker; embedding avoids a second runtime download. */
export function driftwoodDirectorBytes(): Uint8Array {
  if (module.module !== declaration.module) throw new Error('Driftwood finale module is stale');
  return Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0);
}

/** Admit the page's exact immutable module; every host owns independent author memory and quota history. */
export async function prepareDriftwoodDirector(): Promise<() => DirectorLane> {
  const create = await prepareDirectorModule(parseDirector(declaration), driftwoodDirectorBytes());
  return () => create(357);
}

/** Shared finale observations and flag edges. The caller retains update phase, stage save and captain effects. */
export function createDriftwoodFinale(scope: Pick<Scope, 'onDispose'>, lane: DirectorLane, ports: {
  readonly flags: Pick<Flags, 'has' | 'set' | 'onChange'>; readonly player: { readonly x: number; readonly z: number };
  readonly rewardAt: { readonly x: number; readonly z: number }; readonly reward: { started: boolean; completed: boolean };
  readonly captain: ReadonlyMap<string, (value: number) => void>;
}, restoring = false): DirectorScriptStageLane {
  const { flags, player, rewardAt, reward } = ports;
  const clock = new DirectorScriptStageLane(stages, lane, {
    observe: () => ({ altar: Number(flags.has('used:altar')), dead: Number(flags.has('dead:captain')), seen: Number(flags.has('seen:reward')),
      'player-x': player.x, 'player-z': player.z, 'reward-x': rewardAt.x, 'reward-z': rewardAt.z }),
    emits: { source: 'optional', actions: new Map([...ports.captain,
      ['reward.start', () => { reward.started = true; }], ['reward.finish', () => { reward.completed = true; flags.set('seen:reward'); }]]) },
  }, restoring);
  scope.onDispose(flags.onChange((flag, on) => { if (on && (flag === 'used:altar' || flag === 'dead:captain')) clock.changed(); }));
  return clock;
}

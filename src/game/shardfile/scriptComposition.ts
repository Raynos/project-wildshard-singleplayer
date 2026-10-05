import { ScriptComposition } from '@wildshard/engine/script/composition';
import { ScriptDriver, type ScriptLanePort } from '@wildshard/engine/script/lane';
import { ScriptBrainDriver, type ScriptBrainOptions } from '@wildshard/engine/ai/scriptBrain';
import { parseScriptBrain, type ShardScriptBrain } from './brains';
import { prepareShardfileScriptOptions, type ShardScriptContent, type ShardScriptPorts } from './scripts';

/** Session-owned alias handles keep brain motion fields separate from the same actor's numeric declared fields. */
export interface DeclaredScriptBrainActor { actorId: string; entity: number; brain: ShardScriptBrain }
/** The loader supplies actor identities, observations, physics queries and authoritative strike execution. */
export interface DeclaredScriptBrainPorts extends Pick<ScriptBrainOptions, 'actors' | 'query' | 'ports'> { bindings: readonly DeclaredScriptBrainActor[] }
/** One authoritative module union and allowance set for numeric state, items, directors and custom creature decisions. */
export function createShardfileComposedLane(content: ShardScriptContent, assets: ReadonlyMap<string, Uint8Array>, ports: ShardScriptPorts, brains: DeclaredScriptBrainPorts): ScriptLanePort {
  const options = prepareShardfileScriptOptions(content, assets, ports);
  const rows = brains.bindings.map(row => ({ ...row, brain: parseScriptBrain(row.brain) }));
  if (rows.some(row => !content.sim.scripts.includes(row.brain.module))) throw new Error('Brain module must be declared in sim.scripts');
  const numeric = new ScriptDriver(options);
  const brain = new ScriptBrainDriver({ ...brains, modules: options.modules, divisor: 1,
    bindings: rows.map(({ actorId, entity, brain: spec }) => ({ actorId, entity, module: spec.module,
      maxSpeed: spec.maxSpeed, maxStrafe: spec.maxStrafe, maxTurnRate: spec.maxTurnRate, parameters: spec.parameters, strikes: spec.strikes })),
  }, new Map(rows.map(row => [row.entity, row.brain.thinkDivisor])));
  let commands: ReadonlyMap<string, number> = new Map();
  const composition = new ScriptComposition({ modules: options.modules,
    roles: [numeric.role('numeric'), brain.role('brain')],
    schedules: [numeric.schedule('numeric', 'numeric', () => commands), brain.schedule('brain', 'brain')],
    maxEntities: ports.rules.maxEntities,
    ...(ports.limits === undefined ? {} : { limits: ports.limits }),
    ...(ports.development === undefined ? {} : { development: ports.development }),
    ...(ports.toast === undefined ? {} : { toast: ports.toast }),
    ...(ports.onDisabled === undefined ? {} : { onDisabled: ports.onDisabled }),
  });
  return { host: composition.host, world: numeric.world, divisor: numeric.divisor,
    step: (tick, input = new Map()) => { commands = input; return composition.step(tick); },
    enqueue: event => { composition.enqueue(event); }, snapshot: () => composition.snapshot(), restore: text => { composition.restore(text); },
  };
}

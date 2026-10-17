import type { Vector3 } from 'three';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { EnemyWorld } from '@wildshard/engine/entities/species/registry';
import { createMemoryActionBrain, createNativeSpeciesContext, type SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { SimValue } from '@wildshard/engine/sim';
import type { SpeciesBrains } from '@wildshard/sdk/speciesBrains';
import { biteMonkey, throwMonkeyCoconut, pickPerch, setPerch } from '../species/monkeyPolicy';
import authoredSpeciesActions from '../data/speciesActions.json' with { type: 'json' };

const { MONKEY_ACTIONS } = authoredSpeciesActions;

/** One live enemy's shipping policy, observing through ports allocated once at its spawn. */
export interface EnemyBrain { decide: (dt: number) => void; move: (dt: number) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }
/** Existing native host, hunt, stream and world owners, lent unchanged. */
type EnemyBrainPorts = Parameters<typeof createNativeSpeciesContext<EnemyWorld<HuntBody>>>[0];

/**
 * The shipping policy for one Driftwood enemy (species/install.ts `DRIFTWOOD_SPECIES`): the crab's skirmisher in its
 * memory-action adapter, the sailor's guardian and the monkey's perch hunter with
 * perch choice over the baked palm crowns and the shared 'ai' cooldown stream (monkey.ts `monkeyAttackRandom`), the
 * Drowned Captain's authored fight (the admitted decision guest and its logical continuation). The
 * manager's ports (AnimalManager.customContext): steering and confinement through its hunting brain, the E297 attack
 * tokens, reach by the physics line of sight, and a strike landing on the player as PlayerHurt.creature files it, only
 * inside the 70° strike arc (Driftwood's fight is telegraphed) and with a clear line.
 */
export function enemyBrain(kind: string, label: string, actor: HuntBody, herd: readonly HuntBody[] | null, shared: EnemyBrainPorts, brains: SpeciesBrains, decisions: SpeciesDecisionAuthority): EnemyBrain {
  const context = createNativeSpeciesContext(shared, actor, herd, label);
  if(kind==='captain') {
    const policy=brains.body(kind,actor,{host:shared.host,stream:shared.rng,decisions,attacks:{kind:'keeper',claim:()=>context.observation.claim(actor)}});
    if(policy===null)throw new Error('Captain requires its declared body recipe');
    return {decide:policy.decide,move:policy.move,snapshot:policy.snapshot,restore:value=>{
      if(typeof value==='boolean') { // v8's pending contact mark; actor memory is already restored, no guest call.
        actor.mem['subt']=actor.mem['subT']??0;actor.mem['burst-x']=actor.mem['burstX']??actor.position.x;actor.mem['burst-z']=actor.mem['burstZ']??actor.position.z;
        actor.mem['pool-x']=actor.mem['poolX']??actor.position.x;actor.mem['pool-z']=actor.mem['poolZ']??actor.position.z;
      }else policy.restore(value);
    }};
  }
  const actions = brains.actions(kind, actor);
  if (actions !== null) return context.bind(context.observation, actions, actions);
  const ports = Object.assign(context.observation, {
    pickPerch: (a: HuntBody, min: number, max: number, away?: Vector3): number => pickPerch(a, ports, min, max, away),
    setPerch: (a: HuntBody, index: number): void => { setPerch(a, ports, index); },
  });
  type Ports = typeof ports;
  const wrap = (brain: { think: (c: Ports) => void; act: (c: Ports) => void }, policy: { snapshot: () => SimValue; restore: (value: SimValue) => void }): EnemyBrain => context.bind(ports, brain, policy);
  if (brains.kinds.has(kind)) {
    const decision = brains.decision(kind, actor), policy = decision.policy;
    switch (decision.archetype) {
      case 'perch-hunter': return wrap(createMemoryActionBrain<HuntBody, Ports>(actor, MONKEY_ACTIONS, { decide: (_a, c) => { decision.policy.think(c); }, effects: new Map([['bite', biteMonkey], ['throw', throwMonkeyCoconut]]) }), policy);
      case 'skirmisher': case 'guardian': case 'ram-grazer': case 'orbit-diver': case 'burst-flyer': throw new Error('Unknown admitted Driftwood enemy decision');
        default: throw new Error('Unknown admitted Driftwood enemy decision');
    }
  }
  throw new Error(`Driftwood has no enemy policy for ${kind}`);
}

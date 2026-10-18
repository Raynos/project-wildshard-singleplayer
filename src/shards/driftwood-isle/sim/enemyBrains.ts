import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { EnemyWorld } from '@wildshard/engine/entities/species/registry';
import { createMemoryActionBrain, createNativeSpeciesContext, type SpeciesDecision, type SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { SimValue } from '@wildshard/engine/sim';
import type { SpeciesBrains } from '@wildshard/sdk/speciesBrains';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { biteMonkey, throwMonkeyCoconut, type MonkeyBinding, type MonkeyPerchPorts, type MonkeyStrikePorts } from '../species/monkeyBinding';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { Rng } from '@wildshard/engine/core/rng';
import type { PerchHunterPorts } from '@wildshard/engine/ai/guardianPolicy';
import authoredSpeciesActions from '../data/speciesActions.json' with { type: 'json' };

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
export function enemyBrain(kind: string, label: string, actor: HuntBody, herd: readonly HuntBody[] | null, shared: EnemyBrainPorts, brains: SpeciesBrains, decisions: SpeciesDecisionAuthority, bite: StrikeSpec, monkey: MonkeyBinding): EnemyBrain {
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
  if (brains.kinds.has(kind)) {
    const decision = brains.decision(kind, actor), policy = decision.policy;
    return context.bind(context.observation, monkeyActions(monkey, actor, context.observation, decision, bite, context.observation.attackRandom), policy);
  }
  throw new Error(`Driftwood has no enemy policy for ${kind}`);
}

  /** Page and native owners lend their actual observation and cooldown stream;
   * the same adapter refreshes each decision before the original action gates. */
export function monkeyActions<A extends AnimalSim, C extends MonkeyPerchPorts<A> & MonkeyStrikePorts<A> & Omit<PerchHunterPorts<A>, 'pickPerch' | 'setPerch' | 'attackRandom'>>(
    binding: MonkeyBinding, actor: A, first: C, decision: SpeciesDecision<A>, bite: StrikeSpec, attackRandom: Pick<Rng, 'range'>): ReturnType<typeof createMemoryActionBrain<A, C>> {
    if (decision.archetype !== 'perch-hunter') throw new Error('Monkey requires its admitted perch guardian');
    let current = first;
    const ports = { ...first, attackRandom,
      pickPerch: (a: A, min: number, max: number, away?: A['position']): number => binding.pickPerch(a, current, min, max, away),
      setPerch: (a: A, index: number): void => { binding.setPerch(a, current, index); } };
    return createMemoryActionBrain<A, C>(actor, authoredSpeciesActions.MONKEY_ACTIONS, { decide: (_a, context) => {
      current = context; Object.assign(ports, context); decision.policy.think(ports);
    }, effects: new Map([['bite', (a: A, c: C) => { biteMonkey(a, c, bite); }], ['throw', throwMonkeyCoconut]]) });
  }

import type { Vector3 } from 'three';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { EnemyWorld } from '@wildshard/engine/entities/species/registry';
import { createNativeSpeciesContext } from '@wildshard/game/plugin/brain';
import type { SimValue } from '@wildshard/engine/sim';
import { driftwoodSpeciesBrains } from './speciesBrains';
import { CrabBrain } from '../species/crab';
import { SailorBrain } from '../species/sailor';
import { MonkeyBrain, pickPerch, setPerch } from '../species/monkeyPolicy';
import { CaptainBrain } from '../species/captainPolicy';

/** One live enemy's shipping policy, observing through ports allocated once at its spawn. */
export interface EnemyBrain { decide: (dt: number) => void; move: (dt: number) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }
/** Existing native host, hunt, stream and world owners, lent unchanged. */
type EnemyBrainPorts = Parameters<typeof createNativeSpeciesContext<EnemyWorld<HuntBody>>>[0];

/**
 * The shipping policy for one Driftwood enemy (species/install.ts `DRIFTWOOD_SPECIES`): the crab's skirmisher in its
 * CrabBrain shell, the sailor's guardian in its SailorBrain shell, the monkey's perch hunter in its MonkeyBrain shell with
 * perch choice over the baked palm crowns and the shared 'ai' cooldown stream (monkey.ts `monkeyAttackRandom`), the
 * Drowned Captain's authored fight (species/captainPolicy.ts: its continuation is its pending strike step). The
 * manager's ports (AnimalManager.customContext): steering and confinement through its hunting brain, the E297 attack
 * tokens, reach by the physics line of sight, and a strike landing on the player as PlayerHurt.creature files it, only
 * inside the 70° strike arc (Driftwood's fight is telegraphed) and with a clear line.
 */
export function enemyBrain(kind: string, label: string, actor: HuntBody, herd: readonly HuntBody[] | null, shared: EnemyBrainPorts): EnemyBrain {
  const context = createNativeSpeciesContext(shared, actor, herd, label);
  const ports = Object.assign(context.observation, {
    pickPerch: (a: HuntBody, min: number, max: number, away?: Vector3): number => pickPerch(a, ports, min, max, away),
    setPerch: (a: HuntBody, index: number): void => { setPerch(a, ports, index); },
  });
  type Ports = typeof ports;
  const wrap = (brain: { think: (c: Ports) => void; act: (c: Ports) => void }, policy: { snapshot: () => SimValue; restore: (value: SimValue) => void }): EnemyBrain => context.bind(ports, brain, policy);
  if (driftwoodSpeciesBrains.kinds.has(kind)) {
    const decision = driftwoodSpeciesBrains.decision(kind, actor), policy = decision.policy;
    switch (decision.archetype) {
      case 'skirmisher': return wrap(new CrabBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      case 'guardian': return wrap(new SailorBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      case 'perch-hunter': return wrap(new MonkeyBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      case 'ram-grazer': case 'orbit-diver': case 'burst-flyer': throw new Error('Unknown admitted Driftwood enemy decision');
        default: throw new Error('Unknown admitted Driftwood enemy decision');
    }
  }
  if (kind === 'captain') { const brain = new CaptainBrain<HuntBody>(actor); return wrap(brain, { snapshot: () => brain.snapshot(), restore: value => { brain.restore(value); } }); }
  throw new Error(`Driftwood has no enemy policy for ${kind}`);
}

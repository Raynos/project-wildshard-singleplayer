import { Vector3 } from 'three';
import { HURT_ARC, type HuntBody, type HuntBrain } from '@wildshard/engine/ai/hunt';
import { canReach } from '@wildshard/engine/ai/reach';
import type { Rng } from '@wildshard/engine/core/rng';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { driftwoodSpeciesBrains } from './speciesBrains';
import { CrabBrain } from '../species/crab';
import { SailorBrain } from '../species/sailor';
import { stepSailorRise } from '../species/sailorPose';
import { MonkeyBrain, pickPerch, setPerch } from '../species/monkeyPolicy';
import { CaptainBrain } from '../species/captainPolicy';

/** One live enemy's shipping policy, observing through ports allocated once at its spawn. */
export interface EnemyBrain { decide: (dt: number) => void; move: (dt: number) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }
/** The island pieces the enemies' policies read (Enemies.ts `animals.habitat`), renderer-free from the trusted bake. */
export interface EnemyWorld {
  readonly perches: Vector3[];
  readonly perchBases: Vector3[];
  readonly hold: { readonly x: number; readonly z: number; readonly r: number; readonly guardR: number; readonly floorAt: (x: number, z: number) => number | undefined };
  /** Enemies.throwCoconut: lob a coconut from `from` at `to`; absent until the coconuts are owned (a throw releases nothing) */
  readonly throwCoconut?: (from: Vector3, to: Vector3, thrower: HuntBody) => void;
  /** the captain's pool splashes and bubbles: presentation, absent in a renderer-free host */
  readonly splash?: (at: Vector3, strength: number) => void;
}
/** What every enemy's policy shares: the host, the manager's hunting brain (steering, confinement, the attack tokens),
 *  the creature stream, the island and its floor. */
export interface EnemyBrainPorts {
  readonly host: SimHost;
  readonly hunt: HuntBrain<HuntBody>;
  readonly rng: Rng;
  readonly world: EnemyWorld;
  readonly heightAt: (x: number, z: number) => number;
  readonly waterLevel: number;
}

/** The shipping animateSailor's body-continuation lines: rise/sink and the deck-relative
 * root offset are gameplay, even without a renderer. Bone poses remain on the page. */
export function stepSailorMotion(actor: Pick<HuntBody, 'mem' | 'yOffset'>, dt: number): void { stepSailorRise(actor, dt); }

/**
 * The shipping policy for one Driftwood enemy (runtime/brains.ts `declaredCreatureRows`): the crab's skirmisher in its
 * CrabBrain shell, the sailor's guardian in its SailorBrain shell, the monkey's perch hunter in its MonkeyBrain shell with
 * perch choice over the baked palm crowns and the shared 'ai' cooldown stream (monkey.ts `monkeyAttackRandom`), the
 * Drowned Captain's authored fight (species/captainPolicy.ts: its continuation is its pending strike step). The
 * manager's ports (AnimalManager.customContext): steering and confinement through its hunting brain, the E297 attack
 * tokens, reach by the physics line of sight, and a strike landing on the player as PlayerHurt.creature files it, only
 * inside the 70° strike arc (Driftwood's fight is telegraphed) and with a clear line.
 */
export function enemyBrain(kind: string, label: string, actor: HuntBody, herd: readonly HuntBody[] | null, shared: EnemyBrainPorts): EnemyBrain {
  const { host, hunt, world } = shared, player = host.player.position, tags: readonly `${string}.${string}`[] = [`creature.${kind}`, 'feel.blow', 'cover.checked'], cause = { kind, label };
  const dir = new Vector3(), attackRandom = host.rng.stream('ai');
  const reach = (a: HuntBody): boolean => canReach(a, player, host.physics);
  const ports = {
    dt: 0, t: 0, player, playerSpeed: 0, calm: false, rng: shared.rng, herd, world, heightAt: shared.heightAt, waterLevel: () => shared.waterLevel,
    attackRandom: { range: (min: number, max: number): number => attackRandom.range(min, max) },
    hurt: (damage: number): void => {
      if (!hunt.facing(actor, player, HURT_ARC) || !reach(actor)) return;
      host.combat.hit({ source: 'env', sourceTags: tags, target: host.player.health, amount: damage, point: actor.position.clone(), dir, cause });
    },
    // the creature voices are presentation (the browser's onSound)
    sound: (): void => undefined,
    steer: (a: HuntBody, yaw: number, speed: number, turn: number): void => { hunt.steerAny(a, yaw, speed, turn); },
    confine: (a: HuntBody): void => { hunt.confine(a); },
    reach,
    claim: (a: HuntBody): boolean => hunt.tokens.take(a),
    mayAttack: (a: HuntBody): boolean => hunt.tokens.free(a),
    pickPerch: (a: HuntBody, min: number, max: number, away?: Vector3): number => pickPerch(a, ports, min, max, away),
    setPerch: (a: HuntBody, index: number): void => { setPerch(a, ports, index); },
  };
  type Ports = typeof ports;
  const wrap = (brain: { think: (c: Ports) => void; act: (c: Ports) => void }, policy: { snapshot: () => SimValue; restore: (value: SimValue) => void }): EnemyBrain => ({
    decide: dt => { ports.dt = dt; ports.t = host.clock.now; brain.think(ports); },
    move: dt => { ports.dt = dt; ports.t = host.clock.now; brain.act(ports); },
    snapshot: () => policy.snapshot(),
    restore: value => { policy.restore(value); },
  });
  if (driftwoodSpeciesBrains.kinds.has(kind)) {
    const decision = driftwoodSpeciesBrains.decision(kind, actor), policy = decision.policy;
    switch (decision.archetype) {
      case 'skirmisher': return wrap(new CrabBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      case 'guardian': return wrap(new SailorBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      case 'perch-hunter': return wrap(new MonkeyBrain<HuntBody, Ports>(actor, (_a, c) => { decision.policy.think(c); }), policy);
      default: throw new Error('Unknown admitted Driftwood enemy decision');
    }
  }
  if (kind === 'captain') { const brain = new CaptainBrain<HuntBody>(actor); return wrap(brain, { snapshot: () => brain.snapshot(), restore: value => { brain.restore(value); } }); }
  throw new Error(`Driftwood has no enemy policy for ${kind}`);
}

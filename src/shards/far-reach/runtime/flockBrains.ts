import { skyBrainCatalogue } from './brainCatalogue';
import { Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { canReach } from '@wildshard/engine/ai/reach';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { stormRocBrain, type StormRocBrain } from './stormRocBrain';
import type { Home } from '../data/layout';

/** Sky's fight is telegraphed (manifest `fight.telegraphed`): a self-thinking species hurts only inside 70° of its facing. */
const HURT_ARC = (70 * Math.PI) / 180;

/** One live body's shipping policy, observing through ports allocated once at its spawn. */
export interface FlockBrain {
  decide: (dt: number) => void;
  move: (dt: number) => void;
  snapshot: () => SimValue;
  restore: (value: SimValue) => void;
  /** The Storm Roc's body brain (its encounter's port); null for every other kind. */
  readonly roc: StormRocBrain<AnimalSim> | null;
}
/** What every policy shares: the host and the creature manager's own random stream (the goats' wander draws). */
export interface FlockBrainPorts { readonly host: SimHost; readonly rng: Rng }

/**
 * The shipping policy for one Sky body (runtime/brains.ts `declaredSkyRows`, species/stormRoc.ts `rocBrain`): the rays'
 * orbit-diver, the wisps' burst-flyer, the goats' rim-aware ram-grazer and the Storm Roc's own brain, with the creature
 * manager's ports. Sky declares no attack cap, so claim and mayAttack always grant (AggressionService's unlimited
 * director); contacts reach the player through the host's combat pipeline as PlayerHurt.creature files them, only inside
 * the strike arc and with a clear line; the wisp's burst and the Roc's gale wall shove the player through the host's
 * impulse (the client's `app.player.impulse` law).
 */
export function flockBrain(kind: string, label: string, actor: AnimalSim, home: Home, shared: FlockBrainPorts): FlockBrain {
  const { host } = shared, player = host.player.position, push = new Vector3(), tags: readonly `${string}.${string}`[] = [`creature.${kind}`, 'feel.blow', 'cover.checked'];
  const reach = (a: AnimalSim): boolean => canReach(a, player, host.physics);
  const hurt = (damage: number): void => {
    let rel = Math.atan2(player.x - actor.position.x, player.z - actor.position.z) - actor.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > HURT_ARC || !reach(actor)) return;
    host.combat.hit({ source: 'env', sourceTags: tags, target: host.player.health, amount: damage, point: actor.position.clone(), dir: new Vector3(), cause: { kind, label } });
  };
  const shove = (yaw: number, speed: number, lift: number): void => { host.impulsePlayer(push.set(Math.sin(yaw) * speed, lift, Math.cos(yaw) * speed)); };
  const grant = (): boolean => true;
  const ports = { dt: 0, player, calm: false, rng: shared.rng, home: { x: home.x, z: home.z, r: home.r, y: home.y }, reach, claim: grant, mayAttack: grant, hurt, shove,
    flight: { steer: (a: AnimalSim, yaw: number, speed: number, altitude: number, turn?: number): void => { a.fly(yaw, speed, altitude, turn); } } };
  const wrap = (brain: { think: (c: typeof ports) => void; act: (c: typeof ports) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }, roc: StormRocBrain<AnimalSim> | null): FlockBrain => ({
    decide: dt => { ports.dt = dt; brain.think(ports); },
    move: dt => { ports.dt = dt; brain.act(ports); },
    snapshot: () => brain.snapshot(),
    restore: value => { brain.restore(value); },
    roc,
  });
  if (kind === 'stormRoc') { const roc = stormRocBrain<AnimalSim>(actor, shove); return wrap(roc, roc); }
  if (kind !== 'driftRay' && kind !== 'galeWisp' && kind !== 'skyGoat') throw new Error(`Sky has no shipping policy for ${kind}`);
  const decision = skyBrainCatalogue().decision(kind, actor, home);
  if (decision.archetype !== 'ram-grazer' && decision.archetype !== 'orbit-diver' && decision.archetype !== 'burst-flyer') throw new Error(`Sky has no native home policy for ${kind}`);
  return wrap(decision.policy, null);
}

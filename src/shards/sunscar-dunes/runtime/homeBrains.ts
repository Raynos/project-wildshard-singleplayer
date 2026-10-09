import { Vector3 } from 'three';
import { ChallengeGrazerBrain, type ChallengeGrazerSpec } from '@wildshard/engine/ai/challengeGrazer';
import { PatrolDiverBrain, type PatrolDiverSpec } from '@wildshard/engine/ai/patrolDiver';
import { canReach } from '@wildshard/engine/ai/reach';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { SWOOP } from './species/duneRay';
import { CHARGE, HORNS } from './species/strider';
import { SkittererBrain, slot } from './species/skitterer';

/** The melee shards' strike arc: a self-thinking species hurts only inside 70° of its facing (AnimalManager HURT_ARC). */
const HURT_ARC = (70 * Math.PI) / 180;

/** One live home's shipping policy with its own reused observation ports (built once per body, at its spawn). */
export interface HomeBrain { decide: (dt: number) => void; move: (dt: number) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }
/** What every home's policy shares: the host, the attack-token claim and the two data-selected family recipes. */
export interface HomeBrainPorts {
  readonly host: SimHost;
  readonly claim: (actor: AnimalSim) => boolean;
  readonly ray: PatrolDiverSpec & { readonly home: { readonly x: number; readonly z: number } };
  readonly strider: ChallengeGrazerSpec;
}

/**
 * The shipping policy for one fresh home body (plugin.ts / runtime/brains.ts: the ray's patrol-diver, the strider's
 * challenge-grazer with its seeded phase slot, the skitterer's own brain), observing through ports allocated here once.
 * Contacts reach the player through the host's combat pipeline only inside the strike arc and with a clear line.
 */
export function homeBrain(kind: string, actor: AnimalSim, shared: HomeBrainPorts): HomeBrain {
  const { host } = shared, player = host.player.position, point = new Vector3(), dir = new Vector3(), from = new Vector3(), tags: readonly `${string}.${string}`[] = [`creature.${kind}`], move = `sunscar.${kind}.contact`;
  const reach = (a: AnimalSim): boolean => canReach(a, player, host.physics);
  const hurt = (damage: number): void => {
    let rel = Math.atan2(player.x - actor.position.x, player.z - actor.position.z) - actor.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > HURT_ARC || !reach(actor)) return;
    point.copy(player); dir.subVectors(player, actor.position).normalize(); from.copy(actor.position);
    host.combat.hit({ source: actor.combatActor(), sourceTags: tags, target: host.player.health, amount: damage, point, dir, from, moveId: move });
  };
  const ports = { dt: 0, t: 0, player, calm: false, phaseOffset: slot(actor, 6), reach, claim: shared.claim, hurt,
    steer: (a: AnimalSim, yaw: number, speed: number, turn: number): void => { a.setMotion(yaw, speed, turn); },
    flight: { steer: (a: AnimalSim, yaw: number, speed: number, altitude: number, turn: number): void => { a.fly(yaw, speed, altitude, turn); } } };
  const brain = kind === 'duneRay' ? new PatrolDiverBrain(actor, shared.ray, shared.ray.home, SWOOP)
    : kind === 'duneStrider' ? new ChallengeGrazerBrain(actor, shared.strider, CHARGE, HORNS) : new SkittererBrain(actor);
  const observe = (dt: number): void => { ports.dt = dt; ports.t = host.clock.now; };
  return {
    decide: dt => { observe(dt); brain.think(ports); },
    move: dt => { observe(dt); brain.act(ports); },
    snapshot: () => brain.snapshot(),
    restore: value => { brain.restore(value); },
  };
}

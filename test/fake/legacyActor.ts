import * as THREE from 'three';
import { Weapon } from '../../src/engine/combat/Weapon';
import type { Player } from '../../src/engine/player/Player';
import { Animal } from '../../src/engine/entities/Animal';
import type { TargetAnimal } from '../../src/engine/combat/types';
import { legacyDouble } from './FakeGame';

/** Run real legacy methods without constructing their WebGL viewmodel. Missing fields remain loud errors. */
export function legacyActor<T extends object>(prototype: T, surface: Record<string, unknown>): T {
  if (prototype instanceof Weapon) { surface['commandedAim'] = null; surface['aimSource'] = null; }
  const actor = legacyDouble<T>(Object.setPrototypeOf(surface, prototype) as Partial<T>);
  if (actor instanceof Weapon && typeof surface['player'] === 'object' && surface['player'] !== null) {
    const player = surface['player'] as Player;
    actor.setAimSource(() => player.sampleAimCommand());
  }
  return actor;
}
export function invokeLegacy(actor: object, method: string, ...args: unknown[]): unknown {
  const fn: unknown = Reflect.get(actor, method);
  if (typeof fn !== 'function') throw new Error(`legacy method ${method} moved`);
  const result: unknown = Reflect.apply(fn, actor, args);
  return result;
}
interface DamageTarget { animal: Animal & TargetAnimal; dealt: number[]; head: THREE.Vector3; body: THREE.Vector3 }
/** Real Animal.applyDamage, including variant-before-species rounding; no rendering, bones or ragdolls needed. */
export function damageTarget({ kind = 'boar', bodyMul = 1, speciesMul, roll = 37 }: { kind?: string; bodyMul?: number; speciesMul?: number; roll?: number } = {}): DamageTarget {
  const dealt: number[] = [], head = new THREE.Vector3(0, 1.8, -20), body = new THREE.Vector3(0, 0.8, -20);
  const animal = legacyActor(Animal.prototype, {
    entityId: `fixture.${kind}`, kind, alive: true, hp: 100000, scale: 1, yaw: 0, position: new THREE.Vector3(0, 0, -20),
    mods: { damageTaken: bodyMul }, model: { dims: { headRadius: 0.2, bodyY: 0.8, bodyRadius: 0.3 }, species: { damageMul: speciesMul === undefined ? undefined : () => speciesMul } },
    stuckFrame: undefined,
    headWorld: (out: THREE.Vector3) => out.copy(head), damageFor: () => roll,
    onDamaged: (_a: Animal, amount: number): void => { dealt.push(amount); },
  });
  return { animal, dealt, head, body };
}

import type * as THREE from 'three';
import type { Animal } from './Animal';
import type { ThinkCtx } from './species/registry';

/**
 * The named elites' brains (src/nalati/elites.ts sets them, src/game/Elite.ts runs the system): a species that only
 * ever exists as an elite (the snow leopard, the giant eagle, Kokbori, the ghost captain) has `think: eliteThink` and
 * `damageMul: eliteDamageMul`, and its 10 Hz AI tick and its damage rule go to whatever the elite registered for that
 * animal. A tiny module on purpose: species files import it, and it imports nothing at runtime.
 */
const brains = new WeakMap<Animal, (a: Animal, c: ThinkCtx) => void>();
const damage = new WeakMap<Animal, (a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3) => number>();
export function setEliteBrain(a: Animal, fn: (a: Animal, c: ThinkCtx) => void): void { brains.set(a, fn); }
export function setEliteDamage(a: Animal, fn: (a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3) => number): void { damage.set(a, fn); }
export function eliteThink(a: Animal, c: ThinkCtx): void { brains.get(a)?.(a, c); }
export function eliteDamageMul(a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3): number { return damage.get(a)?.(a, hitPoint, dir) ?? 1; }

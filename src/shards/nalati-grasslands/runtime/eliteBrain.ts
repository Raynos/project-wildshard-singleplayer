import type * as THREE from 'three';
import type { Animal } from '@wildshard/engine/entities/AnimalView';

/** Native storm riders retain this damage slot until their owner adopts rows.
 * Page elite decisions and body actions use the shared game encounter host. */
const damage = new WeakMap<Animal, (a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3) => number>();
export function setEliteDamage(a: Animal, fn: (a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3) => number): void { damage.set(a, fn); }
export function eliteDamageMul(a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3): number { return damage.get(a)?.(a, hitPoint, dir) ?? 1; }


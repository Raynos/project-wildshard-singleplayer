import { Vector3 } from 'three';
import type { Home } from '../../../src/shards/far-reach/data/layout';
import type { Animal } from '@wildshard/engine/entities/AnimalView';

/** Where each spawned creature belongs (its island or its flying circle). The plugin sets it at spawn. */
const homes = new WeakMap<Animal, Home>();
export function setHome(a: Animal, home: Home): void { homes.set(a, home); }
export function homeOf(a: Animal, fallback: Home): Home { return homes.get(a) ?? fallback; }
/** Heading in the creature convention (0 faces +Z) from `a` toward a point. */
export const yawTo = (a: Animal, x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);

/**
 * The player push (G24, `app.player.impulse`): the plugin binds it in `play` and unbinds it on dispose, so a brain's
 * strike can shove the player without reaching for the app. Unbound (a test, the Explorer) it does nothing.
 */
let push: ((velocity: Vector3) => void) | null = null;
export function bindPlayerPush(fn: ((velocity: Vector3) => void) | null): void { push = fn; }
const shove = new Vector3();
/** Push the player along the horizontal heading `yaw` (creature convention) at `speed` m/s, `lift` m/s up. */
export function pushPlayer(yaw: number, speed: number, lift: number): void { push?.(shove.set(Math.sin(yaw) * speed, lift, Math.cos(yaw) * speed)); }

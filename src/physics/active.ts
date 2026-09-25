/**
 * The shard's physics world for code that isn't handed it (weapons, aim assist, interact, FX): bootstrap sets it once
 * the `physics` step has built the world. Null before that and in node tests that build their own.
 */
import type { Physics } from './Physics';
import { shardSlot } from '../core/shardState';

let current: Physics | null = null;

export function setActivePhysics(p: Physics | null): void { current = p; }

export function activePhysics(): Physics | null { return current; }

// E155 (src/core/shardState.ts): the running shard's world
shardSlot('physics.active', () => current, (v) => { current = v; });

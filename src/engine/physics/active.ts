/**
 * The shard's physics world for code that isn't handed it (weapons, aim assist, interact, FX): bootstrap sets it once
 * the `physics` step has built the world. Null before that and in node tests that build their own.
 */
import type { Physics } from './Physics';
import { app } from '../app/runtime';
import { shardSlot } from '../core/shardState';

export function setActivePhysics(p: Physics | null): void { app.physics = p; }

export function activePhysics(): Physics | null { return app.physics; }

// E155 (src/engine/core/shardState.ts): the running shard's world
shardSlot('physics.active', () => app.physics, (v) => { app.physics = v; });

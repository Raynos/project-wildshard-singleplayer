import type { Bone, Group } from 'three';
import type { KingRest } from '../src/shards/pine-hollow/combat/kingRig';
import type { readKingCollisionBake } from '../src/shards/pine-hollow/runtime/kingCollisionBake';

export const KING_COLLISION_INPUTS: readonly string[];
export function readKingRig(root: string): { bones: Record<string, Bone>; group: Group; rest: KingRest };
export function bakeKingCollision(root: string): ReturnType<typeof readKingCollisionBake>;

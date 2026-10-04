/**
 * What every collider is made of and who owns it (PHYSICS.md §Architecture). Queries return this with a hit, so a bolt
 * knows to stick in planks and glance off stone, a footstep knows its sound, and a hit knows which animal / door /
 * pickup it touched. The material names extend the footstep system's `GroundSurface` (src/engine/audio/surface.ts).
 *
 * `ground` is the terrain heightfield: its material is not one value, so a query classifies it by position
 * (the level's step map); `edge` is the invisible chunk wall.
 */
import type { Collider } from '@dimforge/rapier3d-simd';
import type { GroundSurface } from '../audio/surface';

/** `felt` (a yurt's walls) and `earth` (a kurgan's turf, a kokpar goal mound): Nalati's soft surfaces — arrows stick, blades thud */
export type Material = GroundSurface | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';

export interface ColliderTag { material: Material; owner: unknown }

// Rapier's canonical Collider wrappers are world-local; numeric handles repeat in independent hosts.
let tags = new WeakMap<Collider, ColliderTag>();

export function tagCollider(c: Collider, material: Material, owner: unknown = null): void {
  tags.set(c, { material, owner });
}

export function tagOf(c: Collider): ColliderTag | undefined { return tags.get(c); }

export function untagCollider(c: Collider): void { tags.delete(c); }

/** Global test reset only. World disposal removes its own collider tags; other live worlds retain theirs. */
export function clearTags(): void { tags = new WeakMap(); }

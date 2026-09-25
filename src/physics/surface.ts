/**
 * What every collider is made of and who owns it (PHYSICS.md §Architecture). Queries return this with a hit, so a bolt
 * knows to stick in planks and glance off stone, a footstep knows its sound, and a hit knows which animal / door /
 * pickup it touched. The material names extend the footstep system's `Surface` (src/audio/Surface.ts).
 *
 * `ground` is the terrain heightfield: its material is not one value, so a query classifies it by position
 * (`SurfaceMap`'s terrain rules); `edge` is the invisible chunk wall.
 */
import type { Collider } from '@dimforge/rapier3d-simd';
import type { Surface } from '../audio/Surface';

/** `felt` (a yurt's walls) and `earth` (a kurgan's turf, a kokpar goal mound): Nalati's soft surfaces — arrows stick, blades thud */
export type Material = Surface | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';

export interface ColliderTag { material: Material; owner: unknown }

const tags = new Map<number, ColliderTag>();

export function tagCollider(c: Collider, material: Material, owner: unknown = null): void {
  tags.set(c.handle, { material, owner });
}

export function tagOf(c: Collider): ColliderTag | undefined { return tags.get(c.handle); }

export function untagCollider(c: Collider): void { tags.delete(c.handle); }

/** Drop every tag (a shard's world was disposed; handles are reused by the next one). */
export function clearTags(): void { tags.clear(); }

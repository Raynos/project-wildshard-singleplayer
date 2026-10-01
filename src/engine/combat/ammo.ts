import type { CombatTag } from './pipeline';

export type AmmoId = `ammo.${string}`;
export interface AmmoRow {
  id: AmmoId; label: string; name: string; flight: { gravity: number; drag: number };
  wet?: { gravity: number; drag: number }; tags: readonly CombatTag[]; material?: string; pouchMax: number;
}
export interface ProjectileModification { ammo: AmmoRow; gravity: number; drag: number }
declare module '../events/maps' {
  interface AskMap { 'projectile.modify': readonly [ProjectileModification, ProjectileModification] }
}

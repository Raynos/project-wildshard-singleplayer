import type { ProjectileKind } from '@wildshard/engine/combat/view/projectile';
/** Product-only night view data; executable policy is admitted by ReturnProgram. */
export interface NightRows {
  program: unknown;
  patrol: unknown;
  motion: unknown;
  slots: unknown;
  ghost: Readonly<Record<'rider' | 'captain' | 'storm', { key: string; common: string; fragment: string }>>;
  parameters: Readonly<Record<string, number>>;
  geometry: { data: unknown };
  arrow: Omit<ProjectileKind, 'geometry' | 'material'>;
  view: { tell: object };
  cues: unknown;
  respawn: number;
  damage: number;
}

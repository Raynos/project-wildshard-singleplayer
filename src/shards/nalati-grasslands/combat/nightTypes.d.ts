import type { ProjectileKind } from '@wildshard/engine/combat/view/projectile';
/** Product-only night view data; executable policy is admitted by ReturnProgram. */
export interface NightRows {
  program: unknown;
  patrol: unknown;
  ghost: Readonly<Record<'rider' | 'captain' | 'storm', { key: string; common: string; fragment: string }>>;
  parameters: Readonly<Record<string, number>>;
  geometry: { data: unknown };
  arrow: Omit<ProjectileKind, 'geometry' | 'material'>;
  wedge: { vertexShader: string; fragmentShader: string };
  respawn: number;
  damage: number;
}

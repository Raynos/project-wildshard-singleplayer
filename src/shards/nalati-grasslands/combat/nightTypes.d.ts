import type { ProjectileKind } from '@wildshard/engine/combat/view/projectile';
/** Product-only night view data; executable policy is admitted by ReturnProgram. */
export interface NightRows {
  programs: {line: unknown; roster: unknown; aim: unknown};
  geometry: { data: unknown };
  arrow: Omit<ProjectileKind, 'geometry' | 'material'>;
  wedge: { vertexShader: string; fragmentShader: string };
  respawn: number;
  damage: number;
}

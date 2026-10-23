/**
 * Nalati zero R6: what an arena-script fight (game/boss/arenaScript) lends its entered view program (G600 L7) at its
 * frame slot, and what that program writes back. Values (read once a frame, never written back): `life` (the fight's
 * retained snapshot fields by name), `clocks` (its clock bank by name), `pose` (the body pose's current bend, raise and
 * castL) and `spear` (the spear's x and z). Cells the fight reads after the frame: the eased pose and the aim's struck
 * and alpha. Ground tells the program draws: the spear and fork rings and one ring per chain landing.
 */
export const ARENA_VIEW = {
  slot: 'arena.frame',
  sources: { life: 'arena.life', clocks: 'arena.clocks', pose: 'arena.pose', spear: 'arena.spear' },
  pose: ['bend', 'raise', 'castL'],
  spear: ['x', 'z'],
  cells: { bend: 'arena.pose.bend', raise: 'arena.pose.raise', castL: 'arena.pose.castL', struck: 'arena.aim.struck', alpha: 'arena.aim.alpha' },
  tells: { spear: 'arena.spear', fork: 'arena.fork' },
} as const;
/** The ground tell a chain landing's ring draws on (landing `index`, 0 based). */
export const arenaChainTell = (index: number): string => `arena.chain.${String(index)}`;

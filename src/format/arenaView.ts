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
  /** the grass fire's own slot (its field steps first): values (on, a reset's clear, the wind, the tier's smoke copies and
   *  rate), the field's arrays (cell modes, lifetimes, the ground under each cell, then this frame's burnt-out cells: a
   *  count and cell indices) and the instanced draws it writes (flames, smoke, scorch decals) */
  fire: { slot: 'arena.fire', values: 'arena.fire', fields: ['on', 'clear', 'windX', 'windZ', 'windSpeed', 'smokeCap', 'smokeRate', 'scorchCap'],
    arrays: { modes: 'arena.field.modes', lifetimes: 'arena.field.lifetimes', ground: 'arena.field.ground', burnt: 'arena.field.burnt' },
    draws: { flames: 'arena.flames', smoke: 'arena.smoke', scorch: 'arena.scorch' } },
  /** the whirlwinds' own slot (after their laws): per whirlwind i the values k{i}, shown{i}, x{i}, y{i} (the ground) and
   *  z{i}; its funnel the entered object `arenaFunnel(i)`; their debris one instanced draw */
  whirls: { slot: 'arena.whirls', values: 'arena.whirls', fields: ['k', 'shown', 'x', 'y', 'z'], draws: { debris: 'arena.debris' } },
} as const;
/** The entered object a whirlwind's funnel is lent as (whirlwind `index`, 0 based). */
export const arenaFunnel = (index: number): string => `arena.funnel.${String(index)}`;
/** The burnt-out cells one fire frame takes (the rest wait for the next frame). */
export const ARENA_BURNT_PER_FRAME = 64;
/** The ground tell a chain landing's ring draws on (landing `index`, 0 based). */
export const arenaChainTell = (index: number): string => `arena.chain.${String(index)}`;

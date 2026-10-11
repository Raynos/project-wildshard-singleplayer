import type * as v from 'valibot';
import type { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

type Swing = v.InferOutput<typeof MeleeWeaponProfileSchema>['moves']['combo'][number];

/** Kylysh combat numbers on foot and in the saddle. Native pose recipes, pass-side selection and reward effects stay trusted. */
export const SABRE_WEAPON_PROFILE = {
  family: 'melee', damage: 24, reach: 2.2, swingScale: 0.9,
  cooldown: 0.08, comboGap: 0.6, chainLag: 0.02, heavyCharge: 0.45,
  moves: { combo: [
    { windup: 0.07, slashEnd: 0.24, total: 0.35, damage: 1, stagger: 0, sweep: 1 },
    { windup: 0.06, slashEnd: 0.22, total: 0.34, damage: 1, stagger: 0, sweep: -1 },
    { windup: 0.1, slashEnd: 0.28, total: 0.44, damage: 16 / 12, stagger: 0.25, sweep: 0.5 },
  ] satisfies [Swing, Swing, Swing], heavy: { windup: 0.06, slashEnd: 0.3, total: 0.62, damage: 2, stagger: 1, sweep: 0.35 },
    passes: {
      left: { windup: 0.09, slashEnd: 0.3, total: 0.5, damage: 1, stagger: 1, sweep: 1, reach: 2.8 },
      right: { windup: 0.09, slashEnd: 0.3, total: 0.5, damage: 1, stagger: 1, sweep: -1, reach: 2.8 },
    } },
  mounted: { reach: 2.8, cooldown: 0.7, sense: 6, chainWindow: 3, chainStep: 0.1, chainMax: 1.4, speedDivisor: 12, behind: -2 },
  lunge: { range: 4, heavyRange: 5, cone: 25 * Math.PI / 180, stop: 1.1, speed: 22, minTime: 0.08, maxTime: 0.15 },
  sweep: { rays: 5, extensions: [0.12, 0.24, 0.36, 0.48], step: 0.09, maxSamples: 6, maxHits: 8 },
} satisfies v.InferOutput<typeof MeleeWeaponProfileSchema>;

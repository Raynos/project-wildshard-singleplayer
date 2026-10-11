import type * as v from 'valibot';
import type { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

type Swing = v.InferOutput<typeof MeleeWeaponProfileSchema>['moves']['combo'][number];

/** The shipping nine-dragon-stack sword combat parameters; the separate move recipes own poses, trails and camera response. */
export const JIAN_MELEE_PROFILE = {
  family: 'melee', damage: 12, reach: 2.2, swingScale: 1,
  cooldown: 0.08, comboGap: 0.6, chainLag: 0.02, heavyCharge: 0.45,
  moves: { combo: [
    { windup: 0.07, slashEnd: 0.235, total: 0.35, damage: 1, stagger: 0, sweep: 1 },
    { windup: 0.06, slashEnd: 0.22, total: 0.34, damage: 1, stagger: 0, sweep: -1 },
    { windup: 0.10, slashEnd: 0.28, total: 0.44, damage: 16 / 12, stagger: 0.25, sweep: 0.5 },
  ] satisfies [Swing, Swing, Swing], heavy: { windup: 0.06, slashEnd: 0.30, total: 0.62, damage: 2, stagger: 1, sweep: 0.35 } },
  lunge: { range: 4, heavyRange: 5, cone: 25 * Math.PI / 180, stop: 1.1, speed: 22, minTime: 0.08, maxTime: 0.15 },
  sweep: { rays: 5, extensions: [0.12, 0.24, 0.36, 0.48], step: 0.09, maxSamples: 6, maxHits: 8 },
} satisfies v.InferOutput<typeof MeleeWeaponProfileSchema>;

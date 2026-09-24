/**
 * Pine Hollow's sky keys (PINE-HOLLOW-REMASTER PH-L2): the Poly Haven CC0 "Qwantani" pure-sky time-lapse — one place, one
 * clear day, shot from dawn to moonlight — so the keys blend into each other without the sky changing character. Each is
 * baked to the gain-mapped pair (`public/assets/hdri/<id>_2k.sky.jpg` + `.gain.png`, ~0.3 MB) by
 * `node scripts/bake-sky-keys.mjs`, which fetches the 2k `.hdr` from Poly Haven (the `.hdr` itself is not committed).
 *
 * Import-free on purpose: the bake script reads this table in Node.
 *
 * `sunU` / `sunEl`: where the HDRI's own sun (or moon, or the brightest glow when the sun is below the horizon) sits —
 * equirect u (three's `equirectUv`: u = atan(z, x) / 2π + 0.5) and elevation in degrees, measured from the 2k files. The
 * whole set was shot facing one way: every sun is at u 0.600. PineDayNight turns each key about the vertical so that its
 * sun sits on the clock's sun azimuth, and the bake paints the HDRI's own disc, aureole and lens spikes out (the clock draws its own sun / moon and aureole).
 */
export interface SkyKey {
  /** Poly Haven asset id (`<id>_2k.hdr`) */
  readonly id: string;
  readonly sunU: number;
  readonly sunEl: number;
  /** degrees around the HDRI's sun painted out by the bake (0 = no disc to remove) */
  readonly paint: number;
}

export const PINE_SKY_KEYS = {
  dawn: { id: 'qwantani_dawn_puresky', sunU: 0.596, sunEl: 9.6, paint: 0 },            // before sunrise: pale, the glow under the horizon
  sunrise: { id: 'qwantani_sunrise_puresky', sunU: 0.6, sunEl: 2.2, paint: 12 },        // the sun on the horizon
  day: { id: 'qwantani_mid_morning_puresky', sunU: 0.6, sunEl: 40.3, paint: 18 },       // clear day
  golden: { id: 'qwantani_late_afternoon_puresky', sunU: 0.6, sunEl: 19.2, paint: 14 }, // golden hour
  sunset: { id: 'qwantani_sunset_puresky', sunU: 0.6, sunEl: 6.1, paint: 14 },          // the pre-remaster fixed sky (its pair was already baked)
  dusk: { id: 'qwantani_dusk_2_puresky', sunU: 0.609, sunEl: 10.5, paint: 0 },         // blue hour after sunset / before dawn
  night: { id: 'qwantani_moon_noon_puresky', sunU: 0.6, sunEl: 60.7, paint: 15 },       // moonlight: the "sun" is the moon, high
} as const satisfies Record<string, SkyKey>;

export type SkyKeyName = keyof typeof PINE_SKY_KEYS;

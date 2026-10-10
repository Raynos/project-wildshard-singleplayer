import type { KeyedSkyStyle } from '@wildshard/sdk/looks/keyedSkyRows';

/**
 * Pine Hollow's day / night sky as a keyed-sky row (`@wildshard/sdk/looks/keyedSky`; PINE-HOLLOW-REMASTER PH-L2, Jake's
 * PH-U7: "the full cycle, 20 + 4 min, dawn / day / golden hour / night, like Driftwood, in photoreal"; picked over the
 * pre-remaster fixed sunset: "A + a brighter night").
 *
 *   phase 0..1 over the cycle (24 min, `?clock=` seconds): [0, 20/24) is the day, sunrise at 0, sunset at 20/24
 *   ?tod=0.4167 | dawn | sunrise | morning | day | golden | sunset | dusk | night   the start phase (`?clock=1e6` freezes it)
 *
 * THE KEYS: the Poly Haven CC0 "Qwantani" pure-sky time-lapse (one place, one clear day, shot from dawn to moonlight), so
 * the keys blend into each other without the sky changing character. Each is baked to the gain-mapped pair
 * (`public/assets/hdri/<id>_2k.key.jpg` + `.key.gain.png`) by `node scripts/bake-sky-keys.mjs`, which fetches the 2k `.hdr`
 * from Poly Haven (the `.hdr` itself is not committed). `sunU` / `sunEl`: where the HDRI's own sun (or moon, or the brightest
 * glow when the sun is below the horizon) sits, measured from the 2k files; the whole set was shot facing one way. The bake
 * paints the HDRI's own disc out (`paint` degrees); the clock draws its own sun / moon and aureole. Pine Hollow's boot
 * downloads all seven pairs at the bar (the boot pack), so the clock never fetches a key mid-play (E44).
 *
 * THE PRESETS light the scene per keyframe (the sun's colour and intensity, the hemisphere fill, the fog, the shafts, the god
 * rays, the cloud layer, the far haze, the lamps, the grade's saturation); `sunset` is the pre-remaster fixed look's numbers
 * (sun 3.8, hemi 0x8fa8d0 / 0x4a3a28 x 0.45, env 1.1, bg 0.95). Colours: a number is an sRGB hex, a triple linear RGB.
 *
 * THE PATHS: the sun rises in the NE (compass 54 deg), stands 52 deg up in the south at noon and sets in the NW (306 deg: the
 * old sunset's azimuth); the moon rides high in the south (about 58 deg, where the night key's moon is).
 */
export const PINE_SKY = {
  dayFraction: 0.8333333333333334, // 20 / 24
  cycleMinutes: 24,
  start: 0.135, // morning + 0.05
  schedule: [{ phase: 'day', from: 6, to: 18, minutes: 20 }, { phase: 'night', from: 18, to: 30, minutes: 4 }],
  keys: {
    dawn: { id: 'qwantani_dawn_puresky', sunU: 0.596, sunEl: 9.6, paint: 0 },            // before sunrise: pale, the glow under the horizon
    sunrise: { id: 'qwantani_sunrise_puresky', sunU: 0.6, sunEl: 2.2, paint: 12 },        // the sun on the horizon
    day: { id: 'qwantani_mid_morning_puresky', sunU: 0.6, sunEl: 40.3, paint: 18 },       // clear day
    golden: { id: 'qwantani_late_afternoon_puresky', sunU: 0.6, sunEl: 19.2, paint: 14 }, // golden hour
    sunset: { id: 'qwantani_sunset_puresky', sunU: 0.6, sunEl: 6.1, paint: 14 },          // the pre-remaster fixed sky
    dusk: { id: 'qwantani_dusk_2_puresky', sunU: 0.609, sunEl: 10.5, paint: 0 },         // blue hour after sunset / before dawn
    night: { id: 'qwantani_moon_noon_puresky', sunU: 0.6, sunEl: 60.7, paint: 15 },       // moonlight: the "sun" is the moon, high
  },
  moonKey: 'night',
  keyFiles: { color: '/assets/hdri/{id}_2k.key.jpg', gain: '/assets/hdri/{id}_2k.key.gain.png' },
  presets: {
    sunrise: {
      key: 'sunrise', bg: 0.8, env: 1.1, light: [1.0, 0.62, 0.38], lightI: 2.8, hemiSky: 0x8a98c0, hemiGround: 0x3a3026, hemiI: 0.36,
      fogSun: [1.0, 0.66, 0.42], fogDist: 0.00055, fogHeight: 0.009, vol: 0.55, volColor: [1.0, 0.66, 0.4], rays: 0.85,
      glow: [2.2, 1.15, 0.55], disc: [1.0, 0.78, 0.55], halo: [1.0, 0.72, 0.5], haloO: 0.95, cloudSun: [1.0, 0.72, 0.52], cloudLit: [0.95, 0.82, 0.78], cloudA: 0.8, far: [0.5, 0.5, 0.6], lamps: 0.35, sat: 0.16,
    },
    // E401: the key's photo (late afternoon, the sun 19° up) is brighter and bluer than the day key's, so at bg 1.3 the sky —
    // half of every portrait frame — out-shone midday's and its IBL drowned the warm sun: golden read as noon everywhere but
    // under the old-growth's canopy. The sky now sits below the day's, the fill is less blue and the sun, aureole, clouds and
    // far haze carry the warmth.
    golden: {
      key: 'golden', bg: 0.85, env: 1.05, light: [1.0, 0.62, 0.32], lightI: 4.6, hemiSky: 0x9c98a8, hemiGround: 0x5c3e20, hemiI: 0.34,
      fogSun: [1.0, 0.66, 0.36], fogDist: 0.0005, fogHeight: 0.005, vol: 0.72, volColor: [1.0, 0.68, 0.38], rays: 1,
      glow: [2.8, 1.4, 0.55], disc: [1.0, 0.86, 0.66], halo: [1.0, 0.74, 0.46], haloO: 0.9, cloudSun: [1.0, 0.66, 0.4], cloudLit: [1.0, 0.84, 0.68], cloudA: 0.75, far: [0.66, 0.6, 0.56], lamps: 0, sat: 0.24,
    },
    day: {
      key: 'day', bg: 1.8, env: 1.1, light: [1.0, 0.96, 0.9], lightI: 4.4, hemiSky: 0xa0b8e0, hemiGround: 0x4d4232, hemiI: 0.5,
      fogSun: [1.0, 0.96, 0.88], fogDist: 0.00035, fogHeight: 0.004, vol: 0.42, volColor: [1.0, 0.95, 0.85], rays: 0.8,
      glow: [1.3, 1.25, 1.15], disc: [1.0, 0.98, 0.95], halo: [1.0, 0.95, 0.88], haloO: 0.55, cloudSun: [1.0, 0.97, 0.92], cloudLit: [1.05, 1.05, 1.05], cloudA: 0.6, far: [0.55, 0.64, 0.8], lamps: 0, sat: 0.14,
    },
    sunset: { // the pre-remaster fixed look's numbers (pine-hollow.ts sky / atmosphere): sun 3.8, hemi 0x8fa8d0 / 0x4a3a28 × 0.45, env 1.1, bg 0.95
      key: 'sunset', bg: 0.95, env: 1.16, light: [1.0, 0.76, 0.5], lightI: 3.8, hemiSky: 0x8fa8d0, hemiGround: 0x4a3a28, hemiI: 0.45,
      fogSun: [1.0, 0.78, 0.5], fogDist: 0.00045, fogHeight: 0.005, vol: 0.55, volColor: [1.0, 0.72, 0.42], rays: 1,
      glow: [2.4, 1.3, 0.55], disc: [1.0, 0.95, 0.85], halo: [1.0, 1.0, 1.0], haloO: 1, cloudSun: [1.0, 0.82, 0.62], cloudLit: [1.0, 1.0, 1.0], cloudA: 1, far: [0.5, 0.58, 0.74], lamps: 0.55, sat: 0.18,
    },
    dusk: {
      key: 'dusk', bg: 0.42, env: 1.2, light: [0.55, 0.6, 0.85], lightI: 0.0, hemiSky: 0x5d6694, hemiGround: 0x2a2430, hemiI: 0.3,
      fogSun: [0.85, 0.55, 0.58], fogDist: 0.0006, fogHeight: 0.008, vol: 0.28, volColor: [0.7, 0.55, 0.75], rays: 0.3,
      glow: [0.45, 0.28, 0.3], disc: [0.9, 0.93, 1.0], halo: [0.6, 0.62, 0.8], haloO: 0.25, cloudSun: [0.8, 0.5, 0.55], cloudLit: [0.48, 0.44, 0.56], cloudA: 0.55, far: [0.24, 0.24, 0.34], lamps: 1, sat: -0.05,
    },
    night: {
      key: 'night', bg: 0.11, env: 3.0, light: [0.6, 0.72, 1.0], lightI: 3.2, hemiSky: 0x4a5e9c, hemiGround: 0x1e2434, hemiI: 0.95,
      fogSun: [0.32, 0.4, 0.58], fogDist: 0.0007, fogHeight: 0.009, vol: 0.4, volColor: [0.42, 0.52, 0.78], rays: 0.55,
      glow: [0.1, 0.13, 0.2], disc: [1.7, 1.8, 2.0], halo: [0.5, 0.6, 0.9], haloO: 0.35, cloudSun: [0.3, 0.36, 0.5], cloudLit: [0.16, 0.19, 0.27], cloudA: 0.18, far: [0.05, 0.065, 0.1], lamps: 1, sat: -0.3,
    },
    dawn: {
      key: 'dawn', bg: 0.5, env: 1.2, light: [0.55, 0.62, 0.9], lightI: 0.0, hemiSky: 0x6d7aa8, hemiGround: 0x2c2a30, hemiI: 0.3,
      fogSun: [0.95, 0.75, 0.68], fogDist: 0.0006, fogHeight: 0.012, vol: 0.35, volColor: [0.85, 0.72, 0.7], rays: 0.3,
      glow: [0.7, 0.5, 0.42], disc: [0.9, 0.93, 1.0], halo: [0.8, 0.7, 0.7], haloO: 0.3, cloudSun: [0.95, 0.7, 0.62], cloudLit: [0.62, 0.58, 0.64], cloudA: 0.6, far: [0.34, 0.37, 0.48], lamps: 0.9, sat: -0.02,
    },
  },
  // keyframes over the phase (sorted; wraps 1 -> 0): sunrise, morning, 0.2, 0.62, golden, sunset, 20/24 + 0.017, 0.885, 0.962, dawn
  frames: [
    [0.008, 'sunrise'], [0.085, 'golden'], [0.2, 'day'], [0.62, 'day'], [0.735, 'golden'],
    [0.8, 'sunset'], [0.8503333333333334, 'dusk'], [0.885, 'night'], [0.962, 'night'], [0.985, 'dawn'],
  ],
  phases: { sunrise: 0.008, morning: 0.085, day: 0.4167, midday: 0.4167, noon: 0.4167, golden: 0.735, sunset: 0.8, dusk: 0.85, night: 0.92, dawn: 0.985 },
  fixed: { midday: 0.4167, golden: 0.735, sunset: 0.8, night: 0.92 },
  lightPresets: { dawn: 0.985, noon: 0.4167, dusk: 0.85, night: 0.92 },
  sun: { riseAz: 54, setAz: 306, noonEl: 52, nightDip: 24 },
  moon: { az: 115, azSpan: 130, el: 26, elRise: 32 },
  night: { rise: [-0.012, 0.04], set: [0.962, 0.997] },
  moonFade: { rise: [0.012, 0.045], set: [0.968, 0.994] },
  dusk: [0.06, 0.35],
  dawn: { at: 0.008, width: [0.01, 0.07] },
  dome: { name: 'pine-sky-dome', radius: 2300, segments: [64, 32] },
} as const satisfies KeyedSkyStyle;

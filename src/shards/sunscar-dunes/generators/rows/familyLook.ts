import { PAINTED } from './sky';

type V2 = readonly [number, number];

/** A painted dusk sky as rows: its name, its two stages' map names, the strip's elevations, the dusk window, the first stage's gain and the hold. */
export interface DuskSkyRow {
  readonly name: string;
  readonly maps: readonly [string, string];
  readonly elevation: V2; readonly window: V2; readonly firstGain: V2; readonly hold: number;
}

/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10) as rows on the engine's
 * painted look (`@wildshard/engine/render/dataLook` paintedLook): the sand is the PBR family's ground layer over the baked
 * maps `sd:grain` / `sd:trail` / `sd:shadow`, its dusk terms the SAND_DUSK curves (`look.curves` rows); the painted dusk
 * dome is the emissive family's sky over the two stages `sd:early` / `sd:late`. No shard shader source is left on either.
 */
/** The painted dome: the two dusk stages over the strip's elevations (data/sky.ts PAINTED), the first stage held at full gain for 2.5 s. */
export const SKY_LOOK: DuskSkyRow = { name: 'Signal Dunes sky', maps: ['sd:early', 'sd:late'], elevation: [PAINTED.elevBottom, PAINTED.elevTop], window: [PAINTED.dusk[0], PAINTED.dusk[1]], firstGain: [0.64, 1], hold: 2.5 };

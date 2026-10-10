import { tuneAo as platformTuneAo, type AoKnobs as PlatformAoKnobs, type AoTuning as PlatformAoTuning } from '@wildshard/game/systems/looks/aoTuning';

/** A look's ambient-occlusion tuning as a data row. */
export type AoTuning = PlatformAoTuning;
/** The AO pass knobs a tuning row writes. */
export type AoKnobs = PlatformAoKnobs;
/** Re-tune the engine's AO pass from a row, and the scene fog it fades with (SHARD-PLATFORM M3). */
export const tuneAo: typeof platformTuneAo = platformTuneAo;

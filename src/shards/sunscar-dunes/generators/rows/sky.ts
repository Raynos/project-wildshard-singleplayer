/**
 * Where the afterglow is brightest (normalized by the look): the set sun 4° under the horizon just right of the signal
 * tower (round 9: mockup A's afterglow peaks right of it). The painted skies (PAINTED below) carry the dusk's colours; the
 * key light is art-directed apart from this (data/sand.ts KEY_DIR). The sand's faces turned from it darken.
 */
export const SKY_SUN = [0.2, -0.07, -0.98] as const;

/**
 * E407 row 5: the painted dusk sky at infinity (loaded by the engine painted look's strip sky, drawn
 * by the platform dusk look, data/renderLook.ts), one seamless 360° strip per dusk stage (art/sunscar-dunes/round-25-sky: pano.py
 * outpaints them with codex image_gen from the mockups' skies, prep.py crops and sizes them). x = heading (0 = the
 * spawn's forward view, -z; 90 = +x), the strip spans elevTop down to elevBottom degrees; above it the top row carries
 * on, darkening a little to the zenith. The dome blends the stages by the dusk (look/dusk.ts: Sefa 0.50, the waymarks
 * 0.62 / 0.74 / 0.86), so the sky deepens with the quest.
 */
// round 18: two stages. Sampled at the five mock cameras, the late painting fits every mockup's sky bands best (the first
// early and mid paintings painted the afterglow too tall); early is the late painting re-coloured twenty minutes earlier
// (art/sunscar-dunes/round-25-sky early_fix.py). Early up to Sefa's dusk, late from just past the logbook's (B prefers it).
// round 19 (seat C: the 0.50-0.54 window swapped the whole sky's palette in about 2 s of play): one slow, continuous change
// over the quest; round 20 (seat C: its ends sat on the staged dusks, so no view ever showed a blend): a window of its
// own, wider than the quest's dusks
export const PAINTED: { readonly dusk: readonly [number, number]; readonly elevTop: number; readonly elevBottom: number } =
  { dusk: [0.35, 0.95], elevTop: 45, elevBottom: -8 };

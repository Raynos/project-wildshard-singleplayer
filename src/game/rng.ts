/** Game vocabulary extends the engine's named random streams. */
declare module '#engine/core/rng' {
  interface RngStreams { loot: true }
}
export const GAME_RNG_STREAM = 'loot';

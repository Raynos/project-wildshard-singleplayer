/**
 * A practice room is up: the Practice arena (src/engine/practice/TrainingArena.ts, 900 m over the shard) or a feature playground
 * (src/playgrounds/, E307, 3 km over it). The player's x / z there is no spot on the shard, so a check that reads x / z
 * alone (a place discovered, the kokpar goat picked up) asks this first — riding the horse track over Nalati's Horse
 * plains must not "discover" them, nor save the flag.
 *
 * Both rooms already say so with `ws:practice-active` (detail true on the way in, false on the way out): this is that
 * event as a value, read without a listener of one's own.
 */
export const practiceRoom = { open: false };

if (typeof document !== 'undefined') {
  document.addEventListener('ws:practice-active', (e) => { if (e instanceof CustomEvent) practiceRoom.open = e.detail === true; });
}

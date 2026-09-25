/**
 * worldTime — the frame's time scale and unscaled step, written by the game loop (Game.ts) before the updaters run.
 *
 * Hit-stop (Driftwood C2): `game.hitStop(seconds)` slows the WORLD (every `game.onUpdate` gets `dt × scale`: the player,
 * the animals, the swing) for that long, while the things that must keep moving read `worldTime.realDt` instead —
 * impact particles, the hit stars, the camera kick / shake, the trail fade. Audio (WebAudio) and the post chain never
 * see the scale. `scale` is 1 whenever nothing is stopped (Pine Hollow never calls hitStop).
 */
import { stateSlot } from './shardState';

export const worldTime = { scale: 1, realDt: 0 };

// E155 (src/core/shardState.ts)
stateSlot('worldTime', worldTime);

/**
 * What a footstep lands on. `GroundSurface`: the built ground a level's step map classifies (decks, a stone dais, the sand,
 * wet sand at the swash line, grass, rock, the shallows); collider materials extend it (src/engine/physics/surface.ts).
 * `StepSurface`: every surface the mixer's steps know (`audio.footstep`, `footstep-<surface>` samples, a level's
 * `player.stepSurface` answer): the ground ones plus 'litter' (forest floor, the mixer's default), mud (a pond's edge),
 * wet (rain), gravel (roads) and metal.
 */
export type GroundSurface = 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water';
export type StepSurface = GroundSurface | 'litter' | 'gravel' | 'mud' | 'wet' | 'metal';

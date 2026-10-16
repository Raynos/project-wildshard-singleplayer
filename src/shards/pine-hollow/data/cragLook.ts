import { CAVE_SHAFT_LOOK } from './caveShaftLook';

// Pine Hollow's crag and cave looks as data (SHARD-PLATFORM M3, look-family rows): the triplanar granite's SF59 material
// graph (CRAG_GRAPHS: world/crags.ts draws the one BatchedMesh in it) and the cave's look near its mouth (CAVE_LOOK:
// @wildshard/sdk/kit/caveInterior; the shaft's look is data/caveShaftLook.ts). The vertex `aCdata` = (AO, sun reach, wet,
// rock): AO multiplies the indirect light, sun reach the directional lights and the haze; `aCtint` = (tint shade, tint
// path / face skin).

/** the look.materials id the crags, the face skin and the cave wear */
export const CRAG_LOOK = 'pine-crag';

/** the granite's lent textures (world/crags.ts lends `mossy_rock`'s albedo / normal / ARM and `rock_ground`'s albedo / normal) */
export const CRAG_TEXTURES = ['rockMap', 'rockNormal', 'rockArm', 'gritMap', 'gritNormal'] as const;

/**
 * The bear cave near its mouth (world/crags.ts hands it to @wildshard/sdk/kit/caveInterior): the shaft and the drips draw
 * within 60 m; under the roof (the floor at the eye's depth, clamped to the passage, + 7 m) the sun's disc goes; the walls'
 * fill is 0.05 + 1.6 × day; the shaft is 0.2 × day × min(1, 0.4 + 2 × max(0, sun.y)) + 0.02; each drip forms on a
 * 1.7 s + (i mod 5) × 0.53 s clock, then falls.
 */
export const CAVE_LOOK = {
  near: 60,
  under: { height: 7, lzMin: -4, lzMax: 36 },
  fill: [0.05, 1.6],
  surface: 'rock',
  shaft: { look: CAVE_SHAFT_LOOK, radialSegments: 20, heightSegments: 6, renderOrder: 7, gain: 0.2, sunBase: 0.4, sunGain: 2, floor: 0.02 },
  drips: { color: 0xcfd8dc, size: 0.045, opacity: 0.85, period: 1.7, periodStep: 0.53, kinds: 5, phaseStep: 0.37, gravity: 9.8, hang: 0.04, minDrop: 0.2 },
} as const;

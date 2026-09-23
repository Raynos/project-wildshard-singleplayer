/**
 * Look v2 — the geometric horizon rings for world layout v2 ("the bowl and the snow ring",
 * docs/design/nalati/layout-v2.md): the big mountains stand SOUTH and EAST, behind the slab's own snow ring, and the land
 * opens NORTH (the Kunes valley running on) and WEST (toward the Ili). Horizon.ts builds these instead of the def's rings
 * in v2. The painted panorama (sky.ts) already carries the snow range from NNE round through E to SSW and the open
 * golden valley in the W / NW, so these rings are its 3D foreground: low green country N and W, foothills rising into
 * the painting S and E, their feet in the cloud deck under the slab (look/cloudSea.ts, y −68) so from above they rise
 * out of the clouds instead of ringing the world like a fence. Compass azimuths: 0 = north (+z), 90 = east (−x), 180 = south, 270 = west.
 */
import type { ChunkHorizon } from '../../chunks/ChunkDef';

export const NALATI_HORIZON_V2: ChunkHorizon = {
  cloudSea: true,
  rings: [
    // near (800 m): the valley running on low to the N and W, foothills climbing S and E toward the range
    {
      r: 800, base: -95, floor: -95, color: [0.16, 0.3, 0.06], top: [0.36, 0.46, 0.11], snowLine: 2, haze: 0.06,
      bands: [
        { azimuth: 0, spread: 60, height: 40, rough: 0.05 },     // north: low green country just breaking the cloud deck
        { azimuth: 300, spread: 45, height: 20, rough: 0 },      // west / north-west: under the deck — the land opens to the Ili
        { azimuth: 90, spread: 45, height: 145, rough: 0.3 },    // east: foothills under the Crags' big brothers
        { azimuth: 140, spread: 30, height: 165, rough: 0.35 },  // south-east
        { azimuth: 190, spread: 40, height: 130, rough: 0.25 },  // south: the ring's outer shoulders
        { azimuth: 240, spread: 25, height: 75, rough: 0.12 },   // south-west: stepping down to the open west
      ],
    },
    // mid (1400 m): the dark forested foothills of the range S and E; only a low far rim N and W
    {
      r: 1400, base: -150, floor: -150, color: [0.08, 0.14, 0.06], top: [0.22, 0.27, 0.13], snowLine: 0.9, haze: 0.12,
      bands: [
        { azimuth: 20, spread: 50, height: 70, rough: 0.3 },
        { azimuth: 290, spread: 50, height: 35, rough: 0.1 },
        { azimuth: 95, spread: 40, height: 330, rough: 0.6 },
        { azimuth: 150, spread: 40, height: 360, rough: 0.6 },
        { azimuth: 205, spread: 35, height: 280, rough: 0.5 },
      ],
    },
  ],
};

import { ISLAND, COVE, PLATEAU, HEADLAND, GULLY, SHRINE, SHORE_LEVEL } from '../data/landscapeRows';
import { smoothstep, clamp } from './landscapeNoise';
import type { TerrainNoise } from './groundField';

/** Original island disc, crag, ravine and knoll equations, before grading and the world datum. */
export function driftwoodLandscape(x: number, z: number, { n, n2 }: TerrainNoise): number {
  const dx = x - ISLAND.x, dz = z - ISLAND.z;
  const r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
  let R = ISLAND.r + n.get(Math.cos(ang) * 1.7 + 3.3, Math.sin(ang) * 1.7) * 32 + n2.fbm(x * 0.006, z * 0.006, 3) * 22;
  R -= smoothstep(1 - COVE.width, 0.995, Math.cos(ang - COVE.ang)) * COVE.depth; // Wreck Cove bitten out of the east shore
  const m = R - r;
  const sea = SHORE_LEVEL;
  // the shelf and the beach keep a real slope through the water line (a smoothstep there would flatten
  // the shallows into a 20 m wide foam sheet)
  let h = m < 0
    ? -2.6 + clamp(1 + m / 130, 0, 1) ** 1.1 * (sea + 2.6)                             // a wide sandy lagoon: 1.5–2.5 m under the pier (clear turquoise over sand, the spawn mockup)
    : sea + clamp(m / 26, 0, 1) ** 0.85 * 1.8 + smoothstep(20, 90, m) * 3.6;            // beach, then the grassy interior
  h += n.fbm(x * 0.04, z * 0.04, 2) * 0.25 * smoothstep(-10, 15, m);       // small dune / ground bumps on land
  // the hut plateau: a flat-topped crag with a craggy (noise-warped) rim and a gentler ramp on the south side
  {
    const px = x - PLATEAU.x, pz = z - PLATEAU.z;
    const pr = Math.hypot(px, pz) + n2.get(px * 0.05 + 9, pz * 0.05) * 6;
    const south = smoothstep(0.2, 0.9, -pz / Math.max(1, Math.hypot(px, pz))) * smoothstep(14, 0, Math.abs(px + 6)); // a 12 m wide ramp toward the pier
    const rimW = 10 + south * 26;
    h += smoothstep(PLATEAU.r + rimW, PLATEAU.r - 4, pr) * PLATEAU.h;
    h += smoothstep(PLATEAU.r - 6, PLATEAU.r - 30, pr) * n.fbm(x * 0.03 + 4, z * 0.03, 2) * 0.6; // the top is not a table
  }
  // the north-east headland: a broad rocky shoulder and a high craggy top, a narrow ramp up its south-west face
  {
    const hx = x - HEADLAND.x, hz = z - HEADLAND.z;
    const d = Math.hypot(hx, hz);
    const crag = n2.get(hx * 0.04 + 21, hz * 0.04) * 9 + n.get(hx * 0.12, hz * 0.12 + 7) * 3;
    const hr = d + crag;
    const sw = smoothstep(0.3, 0.95, (-hx - hz) / Math.max(1, d * 1.4142)) * smoothstep(16, 0, Math.abs(hx - hz) / 1.4142); // ramp along the SW diagonal
    h += smoothstep(HEADLAND.shoulderR + 14 + sw * 20, HEADLAND.shoulderR - 10, hr) * HEADLAND.shoulderH;
    h += smoothstep(HEADLAND.r + 7 + sw * 26, HEADLAND.r - 6, hr) * HEADLAND.h;
    h += smoothstep(HEADLAND.shoulderR, 20, d) * n.fbm(x * 0.025 + 8, z * 0.025, 3) * 2.2 * (1 - sw); // broken, boulder-strewn top
  }
  // the gully: a ravine cut across the headland's south-west climb (NW–SE), spanned by the rope bridge
  {
    const gx = x - GULLY.x, gz = z - GULLY.z;
    const across = (gx + gz) * 0.7071, along = (gx - gz) * 0.7071; // across = the climb's direction
    const cut = smoothstep(GULLY.width / 2 + 3, GULLY.width / 2 - 2, Math.abs(across) + n2.get(along * 0.15, 3.3) * 1.5) * smoothstep(GULLY.length / 2, GULLY.length / 2 - 14, Math.abs(along));
    h -= cut * (GULLY.depth + n.get(x * 0.2, z * 0.2) * 1.2);
  }
  // the shrine knoll: a soft rise with a flat top for the dais
  { const d = Math.hypot(x - SHRINE.x, z - SHRINE.z); h += smoothstep(34, 9, d) * 3.2; }
  return h;

}

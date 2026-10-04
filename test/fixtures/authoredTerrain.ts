import { buildTerrain } from '../../src/engine/world/terrainField';

/** Independent analytic world for engine regression tests; the template now supplies baked data after admission. */
export const AUTHORED_TERRAIN = buildTerrain(357, {
  landscape: (x, z, { n }) => n.get(x * 0.015, z * 0.015) * 0.5,
  trails: [], cabinSites: [],
});

import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { bakeTerrain, type BakedTerrain } from '@wildshard/sdk/bake/terrain';
import { Color } from 'three';
import { TRAIL, HUT } from '../layout';
import { cellGround } from './cell';

/** Trusted build-time landscape: the legacy seed/noise/trail/pool, levelled under G220's roads and plazas (`cellGround`); no callback enters the shardfile. */
export function templateTerrain(): BakedTerrain & { sites: { door: [number, number, number] } } {
  const field = buildTerrain(357, { landscape: (x, z, { n }) => Math.hypot(x - 25, z - 20) < 5 ? -3 : n.get(x * 0.015, z * 0.015) * 0.5, trails: TRAIL, cabinSites: [], finish: cellGround });
  const colour = new Color(0x7e8388);
  return { ...bakeTerrain({ heightAt: field.heightAt, colourAt: () => [colour.r, colour.g, colour.b], family: 'pbr' }), sites: { door: [HUT.x, field.heightAt(HUT.x, HUT.z) + 1.2, HUT.doorZ] } };
}

import { pastelHeightAt } from './landscape';
import { bakeTerrain, type BakedTerrain } from '@wildshard/sdk/bake/terrain';
import { Color } from 'three';
import { HUT } from '../data/layout';

/** Trusted build-time landscape, bound to the `ground` preset material (SF59 / G169): the legacy seed/noise/trail/pool, levelled under G220's roads and plazas (`cellGround`); no callback enters the shardfile. */
export function pastelTerrain(): BakedTerrain & { sites: { door: [number, number, number] } } {
  const heightAt = pastelHeightAt();
  const colour = new Color(0x7e8388);
  return { ...bakeTerrain({ heightAt, colourAt: () => [colour.r, colour.g, colour.b], family: 'ground' }), sites: { door: [HUT.x, heightAt(HUT.x, HUT.z) + 1.2, HUT.doorZ] } };
}

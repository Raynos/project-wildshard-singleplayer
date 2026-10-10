import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { TerrainField, TerrainNoise } from '@wildshard/engine/level/data';
import { bakeTerrain, type BakedTerrain } from '@wildshard/sdk/bake/terrain';
import { Color } from 'three';
import { TRAIL, HUT } from '../layout';
import { cellGround } from './cell';
import { poolMask } from './world';

const smooth = (edge0: number, edge1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };

/** the valley's two ridges (m): they rise east and west of the trail from RIDGE_FOOT to RIDGE_TOP, up to RIDGE_HEIGHT */
const RIDGE_FOOT = 30, RIDGE_TOP = 41, RIDGE_HEIGHT = 4.5;

/**
 * Build-time only: the ink valley's height field, shared by the terrain bake and the props bake (so every prop sits on
 * the same ground): the template's seed / noise / trail / pool with two ridges east and west of the trail that make the
 * yard a north-south valley, levelled under G220's roads and plazas (`cellGround`).
 */
export function inkField(): TerrainField {
  const landscape = (x: number, z: number, { n }: TerrainNoise): number => {
    if (poolMask(x, z)) return -3;
    const ridge = smooth(RIDGE_FOOT, RIDGE_TOP, Math.abs(x)) * (RIDGE_HEIGHT + n.get(x * 0.06, z * 0.06) * 0.8);
    return n.get(x * 0.015, z * 0.015) * 0.5 + ridge;
  };
  return buildTerrain(357, { landscape, trails: TRAIL, cabinSites: [], finish: cellGround });
}

/**
 * Trusted build-time landscape bound to the `ground` toon preset reference (SF59 / G169's ink / cel valley): the valley
 * field (`inkField`) in a sage cel green; no callback enters the shardfile.
 */
export function inkTerrain(): BakedTerrain & { sites: { door: [number, number, number] } } {
  const field = inkField(), colour = new Color(0x8f9c5e);
  return { ...bakeTerrain({ heightAt: field.heightAt, colourAt: () => [colour.r, colour.g, colour.b], family: 'ground' }), sites: { door: [HUT.x, field.heightAt(HUT.x, HUT.z) + 1.2, HUT.doorZ] } };
}

import * as v from 'valibot';
import { NavmeshGroundSchema } from '@wildshard/format/navigation';
import { isJsonData } from '@wildshard/format/json';
import { readScalarLattice } from '@wildshard/engine/world/scalarChannel';
import type { TerrainField } from '@wildshard/engine/level/data';

type Exclusion = (x: number,z: number,y: number) => boolean;
const legacy = v.strictObject({ excludeGroundAt: v.custom<Exclusion>(value => typeof value === 'function') });
const declared = v.strictObject({ ground: NavmeshGroundSchema });

/** Bake-only admission, before world construction. Retain the original live
 * terrain receiver and water -> wet -> trail short circuit; decode once. */
export function navmeshGroundExclusion(input: unknown,terrain: Pick<TerrainField,'waterLevel' | 'trailDistance'> | undefined): Exclusion | undefined {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== 'object' || Object.getOwnPropertySymbols(input).length > 0
    || !Object.values(Object.getOwnPropertyDescriptors(input)).every(row => row.enumerable && 'value' in row)) throw new Error('Invalid navmesh bake policy');
  if (!isJsonData(input)) return v.parse(legacy,input).excludeGroundAt;
  const { ground: row } = v.parse(declared,input);
  if (terrain === undefined) throw new Error('Navmesh ground exclusion requires its bound terrain');
  const wet = readScalarLattice(row.wet);
  return (x,z,y) => y <= terrain.waterLevel()+row.waterMargin || (wet(x,z) > row.wetThreshold && terrain.trailDistance(x,z) > row.trailClearance);
}

import { bindHeightfield, captureHeightfield, HeightfieldBinding } from '../../src/engine/world/Heightfield';
import type { TerrainField } from '../../src/engine/level/data';

type TerrainOverride = Partial<Pick<TerrainField, 'heightAt' | 'normalAt' | 'splatAt' | 'trailDistance' | 'cabinMask' | 'pondMask' | 'waterLevel' | 'streamAt'>>;
/** Tests use the same retained-frame binding as resident worlds; no runtime test override remains. */
export function overrideTerrain(over: TerrainOverride): () => void {
  const current = captureHeightfield();
  return bindHeightfield(new HeightfieldBinding({ ...current.level,
    ground: { ...current.level.ground, terrain: { ...current.base, ...over } } }));
}

import type * as THREE from 'three';
import type { SpeciesRow } from '../../ai/species';
import type { SpeciesDef, VariantDef, BoneDef, FurStyle } from './registry';

export interface EyeSpot { centre: THREE.Vector3; radius: number }
export interface CreatureHull {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  bones: BoneDef[]; thrall: boolean; fur?: Partial<FurStyle>;
}
export interface SpeciesLook extends Pick<SpeciesDef, 'fur' | 'build' | 'pose' | 'gait' | 'postPose' | 'rig' | 'animate' | 'damageMul' | 'eyeGlow' | 'eyeGlowIntensity'> {
  id: string; species: string; kind: string;
  variants?: Readonly<Record<string, Pick<VariantDef, 'tint' | 'fur' | 'traits'>>>;
  preload?: () => Promise<void>;
  skin?: (variant: VariantDef, bones: readonly BoneDef[], eyes: readonly EyeSpot[]) => CreatureHull | null;
}

/** The legacy view/body adapter is assembled at the factory boundary, after kit registration. */
export function speciesWithLook(row: SpeciesRow, look: SpeciesLook): SpeciesDef {
  const variant = (value: VariantDef): VariantDef => ({ ...value, ...look.variants?.[value.id] });
  return { ...row, ...look, variants: row.variants.map(variant),
    ...(row.spawnOnly === undefined ? {} : { spawnOnly: row.spawnOnly.map(variant) }) };
}

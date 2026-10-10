import type { SpeciesRow, SpeciesVariant } from '@wildshard/engine/ai/species';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { speciesWithLook, type SpeciesLook } from '@wildshard/engine/entities/species/look';
import { registerSpecies, type SpeciesDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
import { painterlyAnimalMaterial } from '../look/creatureMaterial';
import { creatureHull, creatureRigs, type CreatureRigs } from './hulls';
import { preloadNalatiBodies } from './bodies';
import { HORSE_SPECIES } from './horse';
import { WOLF_SPECIES } from './wolf';
import { SHEEPDOG_SPECIES } from './sheepdog';
import { BALBAL_SPECIES } from './balbal';
import { GOLDENKING_SPECIES } from './goldenKing';
import { LEOPARD_SPECIES } from './leopard';
import { EAGLE_SPECIES } from './eagle';
import { GHOSTRIDER_SPECIES } from './ghostRider';
import { KOKBORI_SPECIES } from './kokbori';

export const NALATI_DEFINITIONS: readonly SpeciesDef[] = [HORSE_SPECIES, WOLF_SPECIES, SHEEPDOG_SPECIES, BALBAL_SPECIES, GOLDENKING_SPECIES, LEOPARD_SPECIES, EAGLE_SPECIES, GHOSTRIDER_SPECIES, KOKBORI_SPECIES];
function variantRow(v: VariantDef): SpeciesVariant {
  const { tint: _tint, fur: _fur, traits: _traits, ...row } = v;
  return row;
}
export function nalatiRow(def: SpeciesDef): SpeciesRow {
  const { rigContract: _rigContract, fur: _fur, build: _build, pose: _pose, gait: _gait, postPose: _postPose, rig: _rig, animate: _animate,
    damageMul: _damageMul, eyeGlow: _eyeGlow, eyeGlowIntensity: _eyeGlowIntensity, variants, spawnOnly, ...row } = def;
  return { ...row, id: `species.nalati.${def.kind}`, variants: variants.map(variantRow),
    ...(spawnOnly === undefined ? {} : { spawnOnly: spawnOnly.map(variantRow) }) };
}
/** `rigs`: the page's creature rigs unless a test passes its own */
export function nalatiLook(def: SpeciesDef, rigs: CreatureRigs = creatureRigs): SpeciesLook {
  const row = nalatiRow(def);
  const { rigContract, fur, build, pose, gait, postPose, rig, animate, damageMul, eyeGlow, eyeGlowIntensity } = def;
  return { id: `look.nalati.${def.kind}`, species: row.id, kind: def.kind, rigContract, fur, build,
    ...(pose === undefined ? {} : { pose }), ...(gait === undefined ? {} : { gait }),
    ...(postPose === undefined ? {} : { postPose }), ...(rig === undefined ? {} : { rig }),
    ...(animate === undefined ? {} : { animate }), ...(damageMul === undefined ? {} : { damageMul }),
    ...(eyeGlow === undefined ? {} : { eyeGlow }), ...(eyeGlowIntensity === undefined ? {} : { eyeGlowIntensity }),
    variants: Object.fromEntries([...def.variants, ...(def.spawnOnly ?? [])].map(v => [v.id, {
      ...(v.tint === undefined ? {} : { tint: v.tint }), ...(v.fur === undefined ? {} : { fur: v.fur }),
      ...(v.traits === undefined ? {} : { traits: v.traits }),
    }])),
    material: painterlyAnimalMaterial,
    // the rigged hulls and the baked bodies (species/bodies.ts): the factory awaits both before the first herd
    preload: () => Promise.all([rigs.preload(), preloadNalatiBodies()]).then(() => undefined),
    hasSkin: v => creatureHull(def.kind, v.id) !== null,
    loadSkin: async v => { const name = creatureHull(def.kind, v.id); if (name !== null) await rigs.load(name); },
    skin: (v, bones) => { const hull = rigs.skin(def.kind, v.id, bones); return hull === null ? null : { ...hull, normalMap: null, overgrown: false }; },
  };
}
export const NALATI_SPECIES = NALATI_DEFINITIONS.map(nalatiRow);
export const NALATI_LOOKS = NALATI_DEFINITIONS.map((def) => nalatiLook(def));
/** Dynamically derived elite kinds belong to the same resident scope as their parent. */
export function registerNalatiDefinition(def: SpeciesDef, scope: Scope | null = app.levelScope): void {
  if (scope === null) { registerSpecies(def); return; }
  app.species.registerRow(nalatiRow(def), scope); app.species.registerLook(nalatiLook(def), scope);
}
export function installNalatiSpeciesForTests(): void {
  for (const def of NALATI_DEFINITIONS) registerSpecies(speciesWithLook(nalatiRow(def), nalatiLook(def)));
}

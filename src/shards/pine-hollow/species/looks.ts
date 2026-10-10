import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { speciesDef } from '@wildshard/engine/entities/species/registry';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { PINE_BOAR, PINE_BEAR } from './rows';
import { pineCoatsPainted, preloadPineCreatures, skinPineHull } from './hulls';
import { ELK_THRALL_TINT, THRALL_TRAITS, thrallPose } from './thrall';

export const PINE_BOAR_LOOK: SpeciesLook = {
  ...BOAR_LOOK, id: 'pine.look.boar', species: PINE_BOAR.id,
  postPose: thrallPose,
  variants: { ...BOAR_LOOK.variants, thrall: {
    tint: { base: [0.20, 0.19, 0.13], grizzle: [0.34, 0.36, 0.22], dark: [0.09, 0.09, 0.06], black: [0.04, 0.04, 0.03], cheek: [0.26, 0.26, 0.18] },
    traits: { tuskScale: 1.4, ...THRALL_TRAITS },
  } },
  preload: preloadPineCreatures,
  settle: pineCoatsPainted,
  skin: (v, bones, eyes) => skinPineHull('boar', v.id, bones, eyes, v),
};
export const PINE_BEAR_LOOK: SpeciesLook = {
  ...BEAR_LOOK, id: 'pine.look.bear', species: PINE_BEAR.id,
  preload: preloadPineCreatures,
  settle: pineCoatsPainted,
  skin: (v, bones, eyes) => skinPineHull('bear', v.id, bones, eyes, v),
};

/** Legacy species bodies keep their existing rig until their simulation rows are fully moved. */
const legacyLook = (kind: string): SpeciesLook => ({
  ...speciesDef(kind), variants: Object.fromEntries([...speciesDef(kind).variants, ...(speciesDef(kind).spawnOnly ?? [])].map((v) => [v.id, {
    ...(v.tint === undefined ? {} : { tint: v.tint }), ...(v.fur === undefined ? {} : { fur: v.fur }),
    ...(v.traits === undefined ? {} : { traits: v.traits }),
  }])), id: `pine.look.${kind}`, species: `pine.creature.${kind}`, kind,
  preload: preloadPineCreatures,
  settle: pineCoatsPainted,
  skin: (v, bones, eyes) => skinPineHull(kind, v.id, bones, eyes, v),
});
/** Pine's elk look: the kit elk's, plus the thrall's dead olive coat, glass eyes and moss (its traits) and its stiff gait */
export function pineElkLook(): SpeciesLook {
  const look = legacyLook('elk');
  return { ...look, postPose: thrallPose, variants: { ...look.variants, thrall: { tint: ELK_THRALL_TINT, traits: { antlers: 1, ...THRALL_TRAITS } } } };
}
export function pineLooks(): SpeciesLook[] { return [PINE_BOAR_LOOK, PINE_BEAR_LOOK, legacyLook('deer'), pineElkLook(), legacyLook('antler-king')]; }

/** King registers its bespoke body at prewarm; only the hull strategy must be declared at kit. */
export const KING_HULL_LOOK: Pick<SpeciesLook, 'preload' | 'settle' | 'skin'> = {
  preload: preloadPineCreatures,
  settle: pineCoatsPainted,
  skin: (v, bones, eyes) => skinPineHull('antler-king', v.id, bones, eyes, v),
};

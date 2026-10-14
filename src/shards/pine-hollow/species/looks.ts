import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { speciesDef, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { DEER } from '@wildshard/game/systems/species/deer';
import { ELK } from '@wildshard/game/systems/species/elk';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { PINE_BOAR, PINE_BEAR } from './rows';
import { preloadPineCreatures, skinPineHull } from './hulls';
import { hullBody } from './bodies';
import { ELK_THRALL_TINT, THRALL_TRAITS, thrallPose } from './thrall';

export const PINE_BOAR_LOOK: SpeciesLook = {
  ...BOAR_LOOK, id: 'pine.look.boar', species: PINE_BOAR.id,
  postPose: thrallPose,
  variants: { ...BOAR_LOOK.variants, thrall: {
    tint: { base: [0.20, 0.19, 0.13], grizzle: [0.34, 0.36, 0.22], dark: [0.09, 0.09, 0.06], black: [0.04, 0.04, 0.03], cheek: [0.26, 0.26, 0.18] },
    traits: { tuskScale: 1.4, ...THRALL_TRAITS },
  } },
  preload: preloadPineCreatures,
  skin: (v, bones) => skinPineHull('boar', v.id, bones),
};
export const PINE_BEAR_LOOK: SpeciesLook = {
  ...BEAR_LOOK, id: 'pine.look.bear', species: PINE_BEAR.id,
  preload: preloadPineCreatures,
  skin: (v, bones) => skinPineHull('bear', v.id, bones),
};

/** A look over a species def's look fields and variants, on Pine's rigged hulls. `hullOnly`: the def's body is the baked
 *  skeleton (species/bodies.ts), so a hull that is not loaded refuses instead of drawing nothing. */
const legacyLook = (kind: string, def: SpeciesDef = speciesDef(kind), hullOnly = false): SpeciesLook => ({
  ...def, variants: Object.fromEntries([...def.variants, ...(def.spawnOnly ?? [])].map((v) => [v.id, {
    ...(v.tint === undefined ? {} : { tint: v.tint }), ...(v.fur === undefined ? {} : { fur: v.fur }),
    ...(v.traits === undefined ? {} : { traits: v.traits }),
  }])), id: `pine.look.${kind}`, species: `pine.creature.${kind}`, kind,
  preload: preloadPineCreatures,
  skin: (v, bones) => {
    const hull = skinPineHull(kind, v.id, bones);
    if (hull === null && hullOnly) throw new Error(`[pine-hollow] the ${kind} ${v.id} hull is not loaded: its body is the rigged hull, never lofted`);
    return hull;
  },
});
/** Pine's elk look: the kit elk's, plus the thrall's dead olive coat, glass eyes and moss (its traits) and its stiff gait */
export function pineElkLook(): SpeciesLook {
  const look = legacyLook('elk', { ...ELK, build: hullBody('elk') }, true);
  return { ...look, postPose: thrallPose, variants: { ...look.variants, thrall: { tint: ELK_THRALL_TINT, traits: { antlers: 1, ...THRALL_TRAITS } } } };
}
export function pineLooks(): SpeciesLook[] { return [PINE_BOAR_LOOK, PINE_BEAR_LOOK, legacyLook('deer', { ...DEER, build: hullBody('deer') }, true), pineElkLook(), legacyLook('antler-king', undefined, true)]; }

/** King registers its bespoke body at prewarm; only the hull strategy must be declared at kit. */
export const KING_HULL_LOOK: Pick<SpeciesLook, 'preload' | 'skin'> = {
  preload: preloadPineCreatures,
  skin: (v, bones) => skinPineHull('antler-king', v.id, bones),
};

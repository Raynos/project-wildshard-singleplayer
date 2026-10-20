import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { speciesDef, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { productRiggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import type { PineGrazers, ThrallLook } from '../runtime/productSections.generated.d.ts';
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';

const hulls = productRiggedHulls('pine-hollow');
const preloadPineCreatures = hulls.preload, skinPineHull = hulls.skin;

let admitted: PineGrazers | null = null;
/** The page and cold Explorer read the same build-validated grazer section. */
export function preparePineGrazers(product: { readonly section: (name: 'custom/grazers') => PineGrazers }): Promise<void> {
  admitted = product.section('custom/grazers');
  return Promise.resolve();
}
/** A fresh hull-only body on the original authored species fields; no loft runs in play. */
export function pineGrazer(kind: 'deer' | 'elk'): SpeciesDef {
  if (admitted === null) throw new Error('Pine grazers are not admitted');
  const { body, id: _id, ...def } = admitted[kind];
  return { ...def, build: () => structuredClone(body) };
}

export const PINE_BOAR_LOOK: SpeciesLook = {
  ...BOAR_LOOK, id: 'pine.look.boar', species: 'pine.creature.boar',
  variants: { ...BOAR_LOOK.variants, thrall: {
    tint: { base: [0.20, 0.19, 0.13], grizzle: [0.34, 0.36, 0.22], dark: [0.09, 0.09, 0.06], black: [0.04, 0.04, 0.03], cheek: [0.26, 0.26, 0.18] },
    traits: { tuskScale: 1.4, thrall: 1 },
  } },
  preload: preloadPineCreatures,
  skin: (v, bones) => skinPineHull('boar', v.id, bones),
};
export const PINE_BEAR_LOOK: SpeciesLook = {
  ...BEAR_LOOK, id: 'pine.look.bear', species: 'pine.creature.bear',
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
export function pineElkLook(thrall: ThrallLook): SpeciesLook {
  const look = legacyLook('elk', pineGrazer('elk'), true);
  return { ...look, postPose: numericCreaturePose(thrall.pose), variants: { ...look.variants, thrall: { tint: thrall.tint, traits: { antlers: 1, ...thrall.traits } } } };
}
export function pineLooks(thrall: ThrallLook): SpeciesLook[] {
  const postPose = numericCreaturePose(thrall.pose);
  return [{ ...PINE_BOAR_LOOK, postPose }, PINE_BEAR_LOOK, legacyLook('deer', pineGrazer('deer'), true),
    pineElkLook(thrall), legacyLook('antler-king', undefined, true)];
}


import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { speciesDef, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { preloadPineCreatures, skinPineHull } from '../runtime/species/hulls';
import * as lookSchema from 'valibot';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';

// The generator owns the species definitions and quadruped skeleton construction.
// Admission retains tuple types without a runtime copy of the authored constants.
const number = lookSchema.pipe(lookSchema.number(), lookSchema.finite());
const rgb = lookSchema.tuple([number, number, number]);
const fur = lookSchema.object({ texSeed: number, tex: lookSchema.object({ contrast: number, grizzle: number,
  normalStrength: number, bristle: number, strandLen: number, root: number }), roughness: number, sheen: number,
  sheenColor: rgb, envMapIntensity: number, rim: rgb, shellLen: number, shag: number,
  emissive: lookSchema.exactOptional(rgb), emissiveIntensity: lookSchema.exactOptional(number) });
const variant = lookSchema.object({ ...SpeciesSchema.entries.variants.item.entries,
  tint: lookSchema.exactOptional(lookSchema.record(lookSchema.string(), rgb)),
  traits: lookSchema.exactOptional(lookSchema.record(lookSchema.string(), number)),
  fur: lookSchema.exactOptional(lookSchema.object({ rim: lookSchema.exactOptional(rgb), sheenColor: lookSchema.exactOptional(rgb),
    emissive: lookSchema.exactOptional(rgb), emissiveIntensity: lookSchema.exactOptional(number) })) });
const grazer = lookSchema.object({ ...SpeciesSchema.entries, fur, variants: lookSchema.array(variant),
  rigContract: lookSchema.object({ skeleton: lookSchema.string(), clips: lookSchema.array(lookSchema.never()), sockets: lookSchema.array(lookSchema.string()) }),
  pose: lookSchema.object({ grazeNeck: number, gallopTail: number }),
  body: lookSchema.object({ bones: lookSchema.array(lookSchema.object({ name: lookSchema.string(), parent: lookSchema.nullable(lookSchema.string()), pos: rgb })),
    furParts: lookSchema.array(lookSchema.never()), hardParts: lookSchema.array(lookSchema.never()), eyeParts: lookSchema.array(lookSchema.never()),
    dims: lookSchema.object({ bodyY: number, bodyHalfLen: number, bodyRadius: number, headRadius: number, legLen: number,
      feet: lookSchema.array(lookSchema.tuple([number, number])), halfWidth: number }) }) });
const grazers = lookSchema.strictObject({ deer: grazer, elk: grazer });
let admitted: lookSchema.InferOutput<typeof grazers> | null = null;
/** The page and cold Explorer admit the same verified grazer blob before using a model. */
export async function preparePineGrazers(product: Pick<ShardProduct, 'file'>): Promise<void> {
  admitted = lookSchema.parse(grazers, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('actors/grazers.json'))));
}
/** A fresh hull-only body on the original authored species fields; no loft runs in play. */
export function pineGrazer(kind: 'deer' | 'elk'): SpeciesDef {
  if (admitted === null) throw new Error('Pine grazers are not admitted');
  const { body, id: _id, ...def } = admitted[kind];
  return { ...def, build: () => structuredClone(body) };
}

const thrallLookSchema = lookSchema.strictObject({ pose: lookSchema.unknown(),
  traits: lookSchema.record(lookSchema.string(), lookSchema.number()),
  tint: lookSchema.record(lookSchema.string(), lookSchema.tuple([lookSchema.number(), lookSchema.number(), lookSchema.number()])),
});

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
export function pineElkLook(input: unknown): SpeciesLook {
  const thrall = lookSchema.parse(thrallLookSchema, input);
  const look = legacyLook('elk', pineGrazer('elk'), true);
  return { ...look, postPose: numericCreaturePose(thrall.pose), variants: { ...look.variants, thrall: { tint: thrall.tint, traits: { antlers: 1, ...thrall.traits } } } };
}
export function pineLooks(input: unknown): SpeciesLook[] {
  const thrall = lookSchema.parse(thrallLookSchema, input), postPose = numericCreaturePose(thrall.pose);
  return [{ ...PINE_BOAR_LOOK, postPose }, PINE_BEAR_LOOK, legacyLook('deer', pineGrazer('deer'), true),
    pineElkLook(thrall), legacyLook('antler-king', undefined, true)];
}

/** King registers its bespoke body at prewarm; only the hull strategy must be declared at kit. */
export const KING_HULL_LOOK: Pick<SpeciesLook, 'preload' | 'skin'> = {
  preload: preloadPineCreatures,
  skin: (v, bones) => skinPineHull('antler-king', v.id, bones),
};

import * as v from 'valibot';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';

const finite = v.pipe(v.number(), v.finite());
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  flight: v.optional(v.strictObject({ altitude: finite, above: v.optional(v.picklist(['ground', 'world'])), climbRate: finite, diveRate: finite, lockRange: v.optional(finite), bank: v.optional(finite) })) });

/** One baked native spec (a shard's physics bake writes it), admitted strictly; an absent optional stays absent. */
export function bakedSpec(input: unknown): AnimalSimSpec {
  const { flight, lockable, ...rest } = v.parse(BakedSpec, input);
  return { ...rest, ...(lockable === undefined ? {} : { lockable }),
    ...(flight === undefined ? {} : { flight: { altitude: flight.altitude, climbRate: flight.climbRate, diveRate: flight.diveRate,
      ...(flight.above === undefined ? {} : { above: flight.above }), ...(flight.lockRange === undefined ? {} : { lockRange: flight.lockRange }),
      ...(flight.bank === undefined ? {} : { bank: flight.bank }) } }) };
}

/**
 * A physics bake's actors as native specs by kind (SHARD-PLATFORM SF72, the headless runtimes' recipes): every body of a
 * kind shares one recipe, so a divergent one refuses, as does a row whose declared `kind` differs from its spec's.
 */
export function bakedSpecs(actors: readonly { readonly kind?: string; readonly spec: unknown }[]): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>();
  for (const actor of actors) {
    const spec = bakedSpec(actor.spec), kind = actor.kind ?? spec.kind, known = specs.get(kind);
    if (spec.kind !== kind || (known !== undefined && JSON.stringify(known) !== JSON.stringify(spec))) throw new Error(`Divergent native spec ${kind}`);
    specs.set(kind, spec);
  }
  return specs;
}

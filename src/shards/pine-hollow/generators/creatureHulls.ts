/**
 * Pine Hollow's generated creature hulls as a rigged-hull row (`@wildshard/sdk/looks/riggedHulls`; PINE-HOLLOW-REMASTER
 * PH-M1 / PH-M2, Jake's PH-U11), authored as plain data in ../data/creatureHulls.json: each photoreal TRELLIS.2 /
 * Hunyuan3D-2 hull (art/pine-hollow/round-9-creature-refs/) fitted to its species' skeleton by
 * `scripts/creature-rig-bake.mjs --chunk pine-hollow`, worn by every variant listed there in its own coat. The Antler King
 * (PH-M3, board B2 pick A "the Bark Warden") wears his own hull on his own upright rig (E322 F-M1, combat/kingRig.ts),
 * its source his one variant, so his coat is never recoloured.
 *
 * E322 F-M2 (Jake picked B), the bears fixed: both bear hulls came back with a ~25 cm lobe of fur hanging off the top of the
 * rump like a dog's tail (the generator's, not a bear's); `flaps` presses it onto the rump's back plane, read off a slice
 * profile of each rig's mesh (art/pine-hollow/round-19-e322-bears-birds/; the same numbers serve both tiers). The brown
 * hull's three tones are measured off its atlas and mapped onto real brown-bear tones (`measured`), and the sheen and rim
 * take the coat's own hue (`fur`) instead of a pale pink-white.
 *
 * The runtime reads the same JSON (runtime/species/hulls.ts); the generators read it through this typed, checked view.
 */
import * as v from 'valibot';
import authored from '../data/creatureHulls.json' with { type: 'json' };

const num = v.pipe(v.number(), v.finite());
const rgb = v.tuple([num, num, num]);
const flap: v.StrictObjectSchema<{ readonly yMin: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly y0: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly z0: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly slope: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly keep: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly bulge: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; }, undefined> = v.strictObject({ yMin: num, y0: num, z0: num, slope: num, keep: num, bulge: num });
const coat = v.strictObject({
  /** the species default palette (the variant's `tint` overrides keys of it) */
  palette: v.picklist(['deer', 'elk', 'boar', 'bear']),
  /** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
  source: v.tuple([v.string(), v.string()]),
  /** the palette keys: [dark, body, light] */
  keys: v.tuple([v.string(), v.string(), v.string()]),
  /** per variant id, the coat keys' target tones (sRGB; a `grizzle` entry paints silver guard-hair tips) */
  measured: v.exactOptional(v.record(v.string(), v.record(v.string(), rgb))),
});
const RiggedHullsSchema: v.StrictObjectSchema<{ readonly label: v.StringSchema<undefined>; readonly rigs: v.ArraySchema<v.StringSchema<undefined>, undefined>; readonly hulls: v.RecordSchema<v.StringSchema<undefined>, v.StringSchema<undefined>, undefined>; readonly coats: v.RecordSchema<v.StringSchema<undefined>, v.StrictObjectSchema<{ 
/** the species default palette (the variant's `tint` overrides keys of it) */
readonly palette: v.PicklistSchema<["deer", "elk", "boar", "bear"], undefined>; 
/** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
readonly source: v.TupleSchema<[v.StringSchema<undefined>, v.StringSchema<undefined>], undefined>; 
/** the palette keys: [dark, body, light] */
readonly keys: v.TupleSchema<[v.StringSchema<undefined>, v.StringSchema<undefined>, v.StringSchema<undefined>], undefined>; 
/** per variant id, the coat keys' target tones (sRGB; a `grizzle` entry paints silver guard-hair tips) */
readonly measured: v.ExactOptionalSchema<v.RecordSchema<v.StringSchema<undefined>, v.RecordSchema<v.StringSchema<undefined>, v.TupleSchema<[v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>], undefined>, undefined>, undefined>, undefined>; }, undefined>, undefined>; readonly flaps: v.ExactOptionalSchema<v.RecordSchema<v.StringSchema<undefined>, v.StrictObjectSchema<{ readonly yMin: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly y0: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly z0: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly slope: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly keep: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly bulge: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; }, undefined>, undefined>, undefined>; readonly fur: v.ExactOptionalSchema<v.RecordSchema<v.StringSchema<undefined>, v.RecordSchema<v.StringSchema<undefined>, v.StrictObjectSchema<{ readonly rim: v.TupleSchema<[v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>], undefined>; readonly sheenColor: v.TupleSchema<[v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>], undefined>; }, undefined>, undefined>, undefined>, undefined>; }, undefined> = v.strictObject({
  label: v.string(),
  rigs: v.array(v.string()),
  hulls: v.record(v.string(), v.string()),
  coats: v.record(v.string(), coat),
  flaps: v.exactOptional(v.record(v.string(), flap)),
  fur: v.exactOptional(v.record(v.string(), v.record(v.string(), v.strictObject({ rim: rgb, sheenColor: rgb })))),
});

/** One hull's generator flap (the rump's back plane; see riggedHulls' `RiggedHullFlap`). */
export type HullFlapRow = v.InferOutput<typeof flap>;
/** A shard's rigged-hull family, with each hull's coat recipe. */
export type RiggedHullsRow = v.InferOutput<typeof RiggedHullsSchema>;
/** The authored family, checked. */
export const PINE_HULLS: RiggedHullsRow = v.parse(RiggedHullsSchema, authored);

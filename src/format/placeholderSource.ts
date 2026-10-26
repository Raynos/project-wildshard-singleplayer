import * as v from 'valibot';

/**
 * G348 (Jake: the near and far placeholders are generic features for any shard, with no per-shard code): what a shard
 * declares, as its own data, to steer the placeholder bake. Absent fields take the bake's generic defaults: the ground
 * is the shard's baked `terrain.bin`, and a forest drawn by its own tree model is stood in by one generic conifer.
 */
const byte = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255));
const unit = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
/** sRGB 0..255 */
const rgb = v.tuple([byte, byte, byte]);
/**
 * One stand-in tree shape, unit high (scaled by the placement's height): an optional stem (top, radius, colour) and the
 * crown's rings (height, radius) under its apex, in the crown colour; `species` matches the forest placement's species.
 */
export const PlaceholderTreeSchema: v.GenericSchema<PlaceholderTreeInput, PlaceholderTree> = v.strictObject({
  species: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/u)),
  stem: v.nullable(v.tuple([unit, unit, rgb])),
  rings: v.pipe(v.array(v.tuple([unit, unit])), v.maxLength(6)),
  crown: rgb,
});
/** A named export of one of the shard's own bake-time modules (under its `look/` or `generators/`). */
const ModuleExportSchema = v.strictObject({
  module: v.pipe(v.string(), v.regex(/^(?:look|generators)\/[A-Za-z0-9_/-]+\.ts$/u)),
  export: v.pipe(v.string(), v.regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u)),
});
/**
 * How the shard's far proxy is coloured and shaped (G348; was `scripts/bake/farProxiesSource.ts`'s per-shard tables):
 * its far look (a `FarLookSource`), an optional grid its look builds when its land is structures (a `() => FarGrid`),
 * and optional model parts when its land is models (`(tools) => Promise<FarPart[]>`). Without a grid the bake reads the
 * shard's baked `terrain.bin`, else its shardfile terrain collider.
 */
export const PlaceholderFarSchema: v.GenericSchema<PlaceholderFarRowsInput, PlaceholderFarRows> = v.strictObject({
  look: ModuleExportSchema,
  grid: v.optional(ModuleExportSchema),
  parts: v.optional(ModuleExportSchema),
});
/**
 * A shard's whole placeholder steer (`src/shards/<slug>/data/placeholder.ts`'s `PLACEHOLDER`, the one place the bakes
 * look): where its ground comes from, how its forest is stood in and how its far proxy is coloured; every field is
 * optional and an empty row means the bake's generic defaults.
 */
export const PlaceholderSourceSchema: v.GenericSchema<PlaceholderSourceInput, PlaceholderSource> = v.strictObject({
  /** a ground built by the shard's own generator instead of its `terrain.bin`: a module under its `generators/` and the
   *  export that returns the native terrain bytes */
  ground: v.optional(v.strictObject({
    generator: v.pipe(v.string(), v.regex(/^generators\/[A-Za-z0-9_/-]+\.ts$/u)),
    export: v.pipe(v.string(), v.regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u)),
  })),
  /** the forest's stand-in shapes by species; a species without a row takes the first row */
  trees: v.optional(v.pipe(v.array(PlaceholderTreeSchema), v.minLength(1), v.maxLength(16))),
  /** the far proxy's look, and its grid or model parts when its land is not a height field */
  far: v.optional(PlaceholderFarSchema),
  /** the near placeholder's steer: `floors`, the fewest triangles a named prototype (a placed model's id, as the bake's
   *  `--report` lists it) is simplified to, on top of the cell's content budget (a palm whose trunk the common ratio
   *  removes keeps its silhouette); `world: 'tiles'`, its world is its shardfile's coarse tiles (a world built from its
   *  product, with no authored host to visit); `owns`, its near view owns its cell over its own tiles (G630: tiles whose
   *  looks are lit only inside their world, Nine Dragon's night city, never refine over it) */
  near: v.optional(v.strictObject({
    floors: v.optional(v.pipe(v.array(v.strictObject({
      prototype: v.pipe(v.string(), v.regex(/^[A-Za-z0-9][A-Za-z0-9_./-]{0,63}$/u)),
      triangles: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4096)),
    })), v.minLength(1), v.maxLength(16))),
    world: v.optional(v.literal('tiles')),
    owns: v.optional(v.boolean()),
  })),
});
/** One admitted stand-in tree shape (`PlaceholderTreeSchema`): species, optional stem, crown rings and colour, unit high. */

/** A shard's admitted placeholder steer (`PlaceholderSourceSchema`), as the near / far bake reads it. */


/** Admit a shard's declared placeholder source; throws with the shard's name on a malformed row. */
export function placeholderSource(slug: string, value: unknown): PlaceholderSource {
  if (value === undefined) return {};
  const result = v.safeParse(PlaceholderSourceSchema, value);
  if (!result.success) throw new Error(`${slug}: invalid placeholder source: ${result.issues.map((issue) => issue.message).join('; ')}`);
  return result.output;
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type PlaceholderTreeInput = PlaceholderTree;
interface PlaceholderTreeFields {
    species: string;
    stem: ([
        number,
        number,
        [
            number,
            number,
            number
        ]
    ]) | null;
    rings: ([
        number,
        number
    ])[];
    crown: [
        number,
        number,
        number
    ];
}
export type PlaceholderTree = { [Key in keyof PlaceholderTreeFields]: PlaceholderTreeFields[Key] };
export type PlaceholderFarRowsInput = PlaceholderFarRows;
interface PlaceholderFarRowsFields {
    look: {
        module: string;
        export: string;
    };
    grid?: {
        module: string;
        export: string;
    } | undefined;
    parts?: {
        module: string;
        export: string;
    } | undefined;
}
export type PlaceholderFarRows = { [Key in keyof PlaceholderFarRowsFields]: PlaceholderFarRowsFields[Key] };
interface PlaceholderSourceInputFields {
    ground?: {
        generator: string;
        export: string;
    } | undefined;
    trees?: (PlaceholderTreeInput)[] | undefined;
    far?: PlaceholderFarRowsInput | undefined;
    near?: {
        floors?: ({
            prototype: string;
            triangles: number;
        })[] | undefined;
        world?: 'tiles' | undefined;
        owns?: boolean | undefined;
    } | undefined;
}
export type PlaceholderSourceInput = { [Key in keyof PlaceholderSourceInputFields]: PlaceholderSourceInputFields[Key] };
interface PlaceholderSourceFields {
    ground?: {
        generator: string;
        export: string;
    } | undefined;
    trees?: (PlaceholderTree)[] | undefined;
    far?: PlaceholderFarRows | undefined;
    near?: {
        floors?: ({
            prototype: string;
            triangles: number;
        })[] | undefined;
        world?: 'tiles' | undefined;
        owns?: boolean | undefined;
    } | undefined;
}
export type PlaceholderSource = { [Key in keyof PlaceholderSourceFields]: PlaceholderSourceFields[Key] };

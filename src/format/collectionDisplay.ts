import * as v from 'valibot';
import { PackedGeometryRowsSchema } from './geometryPack';
import { AdventureContentSchema } from './questStory';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(10_000_000));
const triple = v.tuple([finite, finite, finite]);
const rect = v.tuple([finite, finite, finite, finite]);
// Reuse the existing placement contract; collections introduces no location identities.
const poi = AdventureContentSchema.entries.places.item.entries.at.entries.poi;
const params = v.record(text, v.union([finite, v.boolean()]));
const ranges = v.pipe(v.array(v.strictObject({ start: natural, count: natural })), v.maxLength(256));

/** Baked display parts: one merged draw, count reveals and paired empty/full trophy slots. */
export const CollectionModelSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<CollectionModelRowInput['id'], CollectionModelRow['id']>; readonly name: v.GenericSchema<CollectionModelRowInput['name'], CollectionModelRow['name']>; readonly objectName: v.GenericSchema<CollectionModelRowInput['objectName'], CollectionModelRow['objectName']>; readonly file: v.GenericSchema<CollectionModelRowInput['file'], CollectionModelRow['file']>; readonly surface: v.GenericSchema<CollectionModelRowInput['surface'], CollectionModelRow['surface']>; readonly geometry: v.GenericSchema<CollectionModelRowInput['geometry'], CollectionModelRow['geometry']>; readonly still: v.GenericSchema<CollectionModelRowInput['still'], CollectionModelRow['still']>; readonly ranges: v.GenericSchema<CollectionModelRowInput['ranges'], CollectionModelRow['ranges']>; readonly defaults: v.GenericSchema<CollectionModelRowInput['defaults'], CollectionModelRow['defaults']>; readonly variants: v.GenericSchema<CollectionModelRowInput['variants'], CollectionModelRow['variants']>; readonly count: v.ExactOptionalSchema<v.GenericSchema<Exclude<CollectionModelRowInput['count'], undefined>, Exclude<CollectionModelRow['count'], undefined>>, undefined>; readonly trophies: v.ExactOptionalSchema<v.GenericSchema<Exclude<CollectionModelRowInput['trophies'], undefined>, Exclude<CollectionModelRow['trophies'], undefined>>, undefined>; }, undefined> = v.strictObject({
  id: text, name: text, objectName: text, file: text, surface: v.picklist(['wood', 'stone', 'metal']), geometry: text,
  still: v.boolean(), ranges, defaults: params,
  variants: v.pipe(v.array(v.strictObject({ id: text, label: text, params })), v.maxLength(64)),
  count: v.exactOptional(v.strictObject({ from: natural, to: natural, parameter: text })),
  trophies: v.exactOptional(v.strictObject({ base: natural, empty: v.record(text, natural), full: v.record(text, natural),
    dropGeometry: text, dropOffsets: v.record(text, triple) })),
});

/** Card metadata is available before cold product admission. */
export const CollectionCardSchema: v.GenericSchema<CollectionCardRowsInput, CollectionCardRows> = v.pick(CollectionModelSchema, ['id', 'name', 'file', 'surface', 'defaults', 'variants']);
export function parseCollectionCard(value: unknown): v.InferOutput<typeof CollectionCardSchema> { return v.parse(CollectionCardSchema, value); }

/** Shared pack and chalk declarations; their named bytes remain in the owning shard product. */
export const CollectionMountPackSchema: v.GenericSchema<CollectionMountPackInput, CollectionMountPack> = v.strictObject({ notice: text, url: text, sha256: text,
  rows: PackedGeometryRowsSchema, slots: v.record(text, natural),
});
export const CollectionChalkSchema: v.GenericSchema<CollectionChalkInput, CollectionChalk> = v.strictObject({ size: v.tuple([natural, natural]), outlines: v.record(text, rect), labels: v.record(text, rect) });



/** Keepsake presentation, without a new save owner: flags/Owned/progression keep their original ids. */
export const CollectionKeepsakesSchema: v.GenericSchema<CollectionKeepsakesInput, CollectionKeepsakes> = v.strictObject({
  floor: v.strictObject({ poi, anchor: text, x: finite, z: finite }),
  placements: v.pipe(v.array(v.strictObject({ model: text, role: v.picklist(['count', 'trophies']),
    poi, x: finite, z: finite, up: finite, yaw: finite, scale: finite, params, piece: v.strictObject({ id: text, name: text }),
  })), v.maxLength(32)),
  flags: v.strictObject({ prefix: text, count: natural }), delay: finite, spacing: finite,
  trophies: v.record(text, text),
  drops: v.record(text, v.strictObject({ model: text, trophy: v.exactOptional(text), wear: v.boolean() })),
  wardrobe: v.pipe(v.array(v.strictObject({ owned: text, slot: v.picklist(['hat', 'cape']), model: text })), v.maxLength(16)),
  restore: v.pipe(v.array(v.strictObject({ flag: text, item: text })), v.maxLength(32)), debugName: text,
});


/** Strict product rows for collection model cards and live keepsake presentation. */
export const CollectionDisplaysSchema: v.GenericSchema<CollectionDisplaysRowsInput, CollectionDisplaysRows> = v.strictObject({ models: v.record(text, CollectionModelSchema), keepsakes: CollectionKeepsakesSchema });
export function parseCollectionDisplays(value: unknown): v.InferOutput<typeof CollectionDisplaysSchema> { return v.parse(CollectionDisplaysSchema, value); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type CollectionModelRowInput = CollectionModelRow;
export interface CollectionModelRow {
    id: string;
    name: string;
    objectName: string;
    file: string;
    surface: 'wood' | 'stone' | 'metal';
    geometry: string;
    still: boolean;
    ranges: ({
        start: number;
        count: number;
    })[];
    defaults: Record<string, (number) | (boolean)>;
    variants: ({
        id: string;
        label: string;
        params: Record<string, (number) | (boolean)>;
    })[];
    count?: {
        from: number;
        to: number;
        parameter: string;
    };
    trophies?: {
        base: number;
        empty: Record<string, number>;
        full: Record<string, number>;
        dropGeometry: string;
        dropOffsets: Record<string, [
            number,
            number,
            number
        ]>;
    };
}
export type CollectionCardRowsInput = Pick<CollectionModelRowInput, 'id' | 'name' | 'file' | 'surface' | 'defaults' | 'variants'>;
export type CollectionCardRows = Pick<CollectionModelRow, 'id' | 'name' | 'file' | 'surface' | 'defaults' | 'variants'>;
export interface CollectionMountPackInput {
    notice: string;
    url: string;
    sha256: string;
    rows: v.InferInput<typeof PackedGeometryRowsSchema>;
    slots: Record<string, number>;
}
export interface CollectionMountPack {
    notice: string;
    url: string;
    sha256: string;
    rows: v.InferOutput<typeof PackedGeometryRowsSchema>;
    slots: Record<string, number>;
}
export type CollectionChalkInput = CollectionChalk;
export interface CollectionChalk {
    size: [
        number,
        number
    ];
    outlines: Record<string, [
        number,
        number,
        number,
        number
    ]>;
    labels: Record<string, [
        number,
        number,
        number,
        number
    ]>;
}
export interface CollectionKeepsakesInput {
    floor: {
        poi: v.InferInput<(typeof AdventureContentSchema)['entries']['places']['item']['entries']['at']['entries']['poi']>;
        anchor: string;
        x: number;
        z: number;
    };
    placements: ({
        model: string;
        role: 'count' | 'trophies';
        poi: v.InferInput<(typeof AdventureContentSchema)['entries']['places']['item']['entries']['at']['entries']['poi']>;
        x: number;
        z: number;
        up: number;
        yaw: number;
        scale: number;
        params: Record<string, (number) | (boolean)>;
        piece: {
            id: string;
            name: string;
        };
    })[];
    flags: {
        prefix: string;
        count: number;
    };
    delay: number;
    spacing: number;
    trophies: Record<string, string>;
    drops: Record<string, {
        model: string;
        trophy?: string;
        wear: boolean;
    }>;
    wardrobe: ({
        owned: string;
        slot: 'hat' | 'cape';
        model: string;
    })[];
    restore: ({
        flag: string;
        item: string;
    })[];
    debugName: string;
}
export interface CollectionKeepsakes {
    floor: {
        poi: v.InferOutput<(typeof AdventureContentSchema)['entries']['places']['item']['entries']['at']['entries']['poi']>;
        anchor: string;
        x: number;
        z: number;
    };
    placements: ({
        model: string;
        role: 'count' | 'trophies';
        poi: v.InferOutput<(typeof AdventureContentSchema)['entries']['places']['item']['entries']['at']['entries']['poi']>;
        x: number;
        z: number;
        up: number;
        yaw: number;
        scale: number;
        params: Record<string, (number) | (boolean)>;
        piece: {
            id: string;
            name: string;
        };
    })[];
    flags: {
        prefix: string;
        count: number;
    };
    delay: number;
    spacing: number;
    trophies: Record<string, string>;
    drops: Record<string, {
        model: string;
        trophy?: string;
        wear: boolean;
    }>;
    wardrobe: ({
        owned: string;
        slot: 'hat' | 'cape';
        model: string;
    })[];
    restore: ({
        flag: string;
        item: string;
    })[];
    debugName: string;
}
export interface CollectionDisplaysRowsInput {
    models: Record<string, CollectionModelRowInput>;
    keepsakes: CollectionKeepsakesInput;
}
export interface CollectionDisplaysRows {
    models: Record<string, CollectionModelRow>;
    keepsakes: CollectionKeepsakes;
}

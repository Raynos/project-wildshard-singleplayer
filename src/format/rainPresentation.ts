import * as v from 'valibot';
import { PackedGeometryRowsSchema } from './geometryPack';
import { WaterSurfaceSchema } from './water';
import { ForestRoofMaskSchema } from './rangedPage';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const count = (max: number) => v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(max));
const tier = (max: number) => v.strictObject({ phone: count(max), desktop: count(max) });
const bake = v.strictObject({ url: v.pipe(v.string(), v.minLength(1), v.maxLength(512)), rows: PackedGeometryRowsSchema });

/**
 * A level's rain as rows (G474 weather presentation; client-only): the curtain round the eye, the cover map's crowns
 * (baked) and roofs (the roof mask's decks and frames), the puddles drawn by a water surface, the splashes at the feet,
 * the drops on the lens and one optional hood box where no rain falls (its ceiling `up` metres over the ground at its
 * frame). `programs` names the three look.materials graphs and the client channel group that turns their params;
 * `rings` the water looks that wear the rain's rings (their `rain` param).
 */
export const RainPresentationSchema: v.GenericSchema<RainPresentationRowsInput, RainPresentationRows> = v.strictObject({
  name: id,
  look: v.strictObject({ coverN: v.pipe(count(1024), v.minValue(8)), streaks: tier(16_384), splashes: tier(512), lensDrops: tier(64) }),
  programs: v.strictObject({ rain: id, splash: id, lens: id, channels: id }),
  cover: v.strictObject({ page: id, roofs: ForestRoofMaskSchema.entries.roofs }),
  hood: v.optional(v.strictObject({ x: n, z: n, rot: n, hw: n, lz0: n, lz1: n, up: n })),
  water: WaterSurfaceSchema,
  rings: v.pipe(v.array(id), v.maxLength(16)),
  bake: v.strictObject({ phone: bake, desktop: bake }),
});
/** A validated rain row. */


/** Admitted data contracts, independent of validator implementation metadata. */
interface RainPresentationRowsInputFields {
    name: string;
    look: {
        coverN: number;
        streaks: {
            phone: number;
            desktop: number;
        };
        splashes: {
            phone: number;
            desktop: number;
        };
        lensDrops: {
            phone: number;
            desktop: number;
        };
    };
    programs: {
        rain: string;
        splash: string;
        lens: string;
        channels: string;
    };
    cover: {
        page: string;
        roofs: v.InferInput<(typeof ForestRoofMaskSchema)['entries']['roofs']>;
    };
    hood?: {
        x: number;
        z: number;
        rot: number;
        hw: number;
        lz0: number;
        lz1: number;
        up: number;
    } | undefined;
    water: v.InferInput<typeof WaterSurfaceSchema>;
    rings: (string)[];
    bake: {
        phone: {
            url: string;
            rows: v.InferInput<typeof PackedGeometryRowsSchema>;
        };
        desktop: {
            url: string;
            rows: v.InferInput<typeof PackedGeometryRowsSchema>;
        };
    };
}
export type RainPresentationRowsInput = { [Key in keyof RainPresentationRowsInputFields]: RainPresentationRowsInputFields[Key] };
interface RainPresentationRowsFields {
    name: string;
    look: {
        coverN: number;
        streaks: {
            phone: number;
            desktop: number;
        };
        splashes: {
            phone: number;
            desktop: number;
        };
        lensDrops: {
            phone: number;
            desktop: number;
        };
    };
    programs: {
        rain: string;
        splash: string;
        lens: string;
        channels: string;
    };
    cover: {
        page: string;
        roofs: v.InferOutput<(typeof ForestRoofMaskSchema)['entries']['roofs']>;
    };
    hood?: {
        x: number;
        z: number;
        rot: number;
        hw: number;
        lz0: number;
        lz1: number;
        up: number;
    } | undefined;
    water: v.InferOutput<typeof WaterSurfaceSchema>;
    rings: (string)[];
    bake: {
        phone: {
            url: string;
            rows: v.InferOutput<typeof PackedGeometryRowsSchema>;
        };
        desktop: {
            url: string;
            rows: v.InferOutput<typeof PackedGeometryRowsSchema>;
        };
    };
}
export type RainPresentationRows = { [Key in keyof RainPresentationRowsFields]: RainPresentationRowsFields[Key] };

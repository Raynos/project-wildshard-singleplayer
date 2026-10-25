import * as v from 'valibot';
import { CollectionMountPackSchema, CollectionChalkSchema } from './collectionDisplay';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512)), text = v.string();
/** Client-only equipment, pickup, collection and ambience composition. */
export const RangedPageSchema: v.GenericSchema<RangedPageRowsInput, RangedPageRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Ranged page requires JSON rows'), v.strictObject({
  id, forest: id, elites: id, combat: id, finishSource: id,
  menu: v.strictObject({ title: text, note: text, hint: text, gearHint: text, noTrade: text, lines: v.record(id, text) }),
  drops: v.strictObject({ stream: id, rifleStream: id, rifle: v.strictObject({ at: v.tuple([n, n, n]), label: text, toast: text, scale: n, parameters: v.array(id) }), labels: v.record(id, text) }),
  prewarm: v.pipe(v.array(v.strictObject({ kind: id, variant: id })), v.maxLength(3)),
  collection: v.strictObject({ source: id, pack: CollectionMountPackSchema, chalk: CollectionChalkSchema,
    texture: v.strictObject({ url: id, srgb: v.boolean(), repeat: v.boolean() }) }),
  debugLap: v.exactOptional(v.strictObject({ fightRadius: n, bossBusy: text,
    spots: v.pipe(v.array(v.strictObject({ id, x: n, z: n, yaw: n, y: v.exactOptional(n) })), v.minLength(1), v.maxLength(64)) })),
  life: id, directional: v.boolean(), shadowBatch: v.boolean(),
}));

/** The guide is a native quest id. */
export const ForestWeatherObservationSchema: v.GenericSchema<ForestWeatherObservationRowsInput, ForestWeatherObservationRows> = v.strictObject({ page: id, audio: id, guide: id });
const roofs = v.pipe(v.array(v.strictObject({ frame: v.strictObject({ x: n, z: n, yaw: n }), polygon: v.pipe(v.array(v.tuple([n, n])), v.maxLength(128)) })), v.maxLength(16));
/** Declared rain occluders share native deck and yaw-frame polygon queries; roofs are baked in their own frame. */
export const ForestRoofMaskSchema: v.StrictObjectSchema<{ readonly floors: v.GenericSchema<ForestRoofMaskRowsInput['floors'], ForestRoofMaskRows['floors']>; readonly roofs: v.GenericSchema<ForestRoofMaskRowsInput['roofs'], ForestRoofMaskRows['roofs']>; }, undefined> = v.strictObject({ floors: v.pipe(v.array(v.strictObject({ x: n, y: n, z: n, hw: n, hd: n, rot: n })), v.maxLength(128)),
  roofs });

/** Admitted data contracts, independent of validator implementation metadata. */
export type RangedPageRowsInput = unknown;
interface RangedPageRowsFields {
    id: string;
    forest: string;
    elites: string;
    combat: string;
    finishSource: string;
    menu: {
        title: string;
        note: string;
        hint: string;
        gearHint: string;
        noTrade: string;
        lines: Record<string, string>;
    };
    drops: {
        stream: string;
        rifleStream: string;
        rifle: {
            at: [
                number,
                number,
                number
            ];
            label: string;
            toast: string;
            scale: number;
            parameters: (string)[];
        };
        labels: Record<string, string>;
    };
    prewarm: ({
        kind: string;
        variant: string;
    })[];
    collection: {
        source: string;
        pack: v.InferOutput<typeof CollectionMountPackSchema>;
        chalk: v.InferOutput<typeof CollectionChalkSchema>;
        texture: {
            url: string;
            srgb: boolean;
            repeat: boolean;
        };
    };
    debugLap?: {
        fightRadius: number;
        bossBusy: string;
        spots: ({
            id: string;
            x: number;
            z: number;
            yaw: number;
            y?: number;
        })[];
    };
    life: string;
    directional: boolean;
    shadowBatch: boolean;
}
export type RangedPageRows = { [Key in keyof RangedPageRowsFields]: RangedPageRowsFields[Key] };
export type ForestWeatherObservationRowsInput = ForestWeatherObservationRows;
interface ForestWeatherObservationRowsFields {
    page: string;
    audio: string;
    guide: string;
}
export type ForestWeatherObservationRows = { [Key in keyof ForestWeatherObservationRowsFields]: ForestWeatherObservationRowsFields[Key] };
export type ForestRoofMaskRowsInput = ForestRoofMaskRows;
interface ForestRoofMaskRowsFields {
    floors: ({
        x: number;
        y: number;
        z: number;
        hw: number;
        hd: number;
        rot: number;
    })[];
    roofs: ({
        frame: {
            x: number;
            z: number;
            yaw: number;
        };
        polygon: ([
            number,
            number
        ])[];
    })[];
}
export type ForestRoofMaskRows = { [Key in keyof ForestRoofMaskRowsFields]: ForestRoofMaskRowsFields[Key] };

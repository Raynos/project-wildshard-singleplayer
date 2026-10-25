import * as v from 'valibot';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** A generated cave cut consists of physics rectangles and triangle-AABB holes. */
export const PageTerrainCutSchema: v.GenericSchema<PageTerrainCutRowsInput, PageTerrainCutRows> = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  frame: v.strictObject({ x: n, z: n, yaw: n }),
  cuts: v.pipe(v.array(v.strictObject({ lx: n, lz: n, hw: n, hd: n, below: n })), v.maxLength(128)),
  holes: v.pipe(v.array(v.strictObject({ lx: n, lz: n, hw: n, hd: n, y0: n, y1: n })), v.maxLength(128)),
}));

/** Material bindings over a real engine pond surface and its probe. */
export const PageWaterBindingSchema: v.GenericSchema<PageWaterBindingRowsInput, PageWaterBindingRows> = v.strictObject({ object: id, look: id, looks: v.pipe(v.array(id), v.maxLength(8)),
  ripples: id, skyline: id, centre: id, probe: id });

/** Native path ramps use the bound floor and registered deck carriers. */
export const PagePathRampSchema: v.GenericSchema<PagePathRampRowsInput, PagePathRampRows> = v.strictObject({ id, name: id });

/** Admitted data contracts, independent of validator implementation metadata. */
export type PageTerrainCutRowsInput = unknown;
interface PageTerrainCutRowsFields {
    frame: {
        x: number;
        z: number;
        yaw: number;
    };
    cuts: ({
        lx: number;
        lz: number;
        hw: number;
        hd: number;
        below: number;
    })[];
    holes: ({
        lx: number;
        lz: number;
        hw: number;
        hd: number;
        y0: number;
        y1: number;
    })[];
}
export type PageTerrainCutRows = { [Key in keyof PageTerrainCutRowsFields]: PageTerrainCutRowsFields[Key] };
export type PageWaterBindingRowsInput = PageWaterBindingRows;
interface PageWaterBindingRowsFields {
    object: string;
    look: string;
    looks: (string)[];
    ripples: string;
    skyline: string;
    centre: string;
    probe: string;
}
export type PageWaterBindingRows = { [Key in keyof PageWaterBindingRowsFields]: PageWaterBindingRowsFields[Key] };
export type PagePathRampRowsInput = PagePathRampRows;
interface PagePathRampRowsFields {
    id: string;
    name: string;
}
export type PagePathRampRows = { [Key in keyof PagePathRampRowsFields]: PagePathRampRowsFields[Key] };

import * as v from 'valibot';
import type { GlyphFieldLayout, GlyphRect } from './glyphField';
import type { PlacedSign } from './signCopies';

/** Retained native raster metadata, supplied by the product's declared input reader. */
export interface NineNativeSignInputs {
  readonly glyphs: Readonly<Record<'phone' | 'desktop', {
    readonly size: number; readonly packed: readonly string[];
    readonly layout: GlyphFieldLayout;
    readonly rects: Readonly<Record<string, GlyphRect>>;
  }>>;
  readonly atlas: Readonly<Record<'phone' | 'desktop', {
    readonly buffer: string;
    readonly keys: Readonly<Record<string, string>>;
    readonly placed: readonly (Omit<PlacedSign, 'p'> & { readonly p: Omit<PlacedSign['p'], 'at' | 'normal'> & {
      readonly at: readonly (number | string)[]; readonly normal: readonly (number | string)[];
    } })[];
    readonly lights: readonly { readonly at: readonly number[]; readonly color: readonly number[];
      readonly w: number; readonly h: number; readonly power: number; readonly spill: number }[];
    readonly geometries: Readonly<Record<string, { readonly sphere: number[] | null;
      readonly attributes: Readonly<Record<string, { readonly width: number; readonly data: { byteOffset: number; byteLength: number } }>>;
      readonly index: { byteOffset: number; byteLength: number } }>>;
    readonly mono: { packed: string; bytes: number }; readonly colour: { packed: string; bytes: number };
  }>>;
}

/** Native raster metadata keeps its original property order and signed-zero words. */
export type NineNativeAtlas = NineNativeSignInputs['atlas'] & Readonly<Record<'phone' | 'desktop', {
  readonly cells: Readonly<Record<string, unknown>>;
}>>;

/** Validate supplied native metadata before its geometry ranges or light rows are consumed. */
export function parseNativeSignAtlas(input: unknown): NineNativeAtlas {
  const finite = v.pipe(v.number(), v.finite());
  const range = v.object({ byteOffset: v.pipe(finite, v.integer(), v.minValue(0)), byteLength: v.pipe(finite, v.integer(), v.minValue(0)) });
  const placement = v.object({ w: finite, h: finite, neon: v.boolean(), p: v.object({
    at: v.array(v.union([finite, v.string()])), normal: v.array(v.union([finite, v.string()])), size: finite,
    spec: v.object({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.string(), ink: v.exactOptional(v.string()) }),
    gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
    board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
  }) });
  const tier = v.object({ buffer: v.string(), cells: v.record(v.string(), v.unknown()), placed: v.array(placement),
    lights: v.array(v.object({ at: v.array(finite), color: v.array(finite), w: finite, h: finite, power: finite, spill: finite })),
    keys: v.record(v.string(), v.string()), mono: v.object({ packed: v.string(), bytes: finite }), colour: v.object({ packed: v.string(), bytes: finite }),
    geometries: v.record(v.string(), v.object({ attributes: v.record(v.string(), v.object({ width: finite, data: range })),
      index: range, sphere: v.nullable(v.array(finite)) })) });
  v.assert(v.object({ phone: tier, desktop: tier }), input);
  return input;
}


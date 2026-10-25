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


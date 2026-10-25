import type { PlaceGeometryRow } from './placeRows';
/** A committed bake as the page reads it: its stamped rows and the raw binary (inflated, lanes put back). */
export interface CommittedPlacesBake<R> { readonly rows: { readonly bin: string; readonly bytes: number; readonly rows: readonly R[] }; readonly raw: Uint8Array }
/** The raw binary from its shipped lanes (every 4-byte word's first bytes, then its second …). */
export function unshuffle(lanes: Uint8Array): Uint8Array;
/** The first difference between a committed bake and a rebake's rows and binary (rows within 1e-9, floats within 2^-20), or null. */
export function bakeDifference<R>(file: string, committed: CommittedPlacesBake<R>, made: { readonly rows: readonly R[]; readonly bin: Uint8Array }, geos: (row: R) => readonly { readonly geometry: PlaceGeometryRow }[]): string | null;

/** Read the exact native terrain for the separate painted recipe. */
export function readNalatiTerrain(): ArrayBuffer;
/** Publish or byte-compare only the admitted native Nalati geometry envelopes. */
export function writeNalatiParts(parts: readonly { readonly name: 'places' | 'specimens'; readonly json: 'places.json' | 'placeSpecimens.json'; readonly part: { readonly rows: readonly unknown[]; readonly bin: Uint8Array } }[], check?: boolean): void;

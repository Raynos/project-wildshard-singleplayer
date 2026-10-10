import type { DressingGeoRow, PlaceGeometryRow, PlaceRow, SpecimenRow } from '../world/placeBake';
/** A committed bake as the page reads it: its stamped rows and the raw binary (inflated, lanes put back). */
export interface CommittedPlacesBake<R> { readonly rows: { readonly bin: string; readonly bytes: number; readonly rows: readonly R[] }; readonly raw: Uint8Array }
/** The raw binary from its shipped lanes (every 4-byte word's first bytes, then its second …). */
export function unshuffle(lanes: Uint8Array): Uint8Array;
/** The committed places, specimens and dressing-shape bakes (rows, raw binary) as the page reads them; throws when a binary is not its rows'. */
export function committedPlaces(): { places: CommittedPlacesBake<PlaceRow>; specimens: CommittedPlacesBake<SpecimenRow>; dressing: CommittedPlacesBake<DressingGeoRow> };
/** The first difference between a committed bake and a rebake's rows and binary (rows within 1e-9, floats within 2^-20), or null. */
export function bakeDifference<R>(file: string, committed: CommittedPlacesBake<R>, made: { readonly rows: readonly R[]; readonly bin: Uint8Array }, geos: (row: R) => readonly { readonly geometry: PlaceGeometryRow }[]): string | null;

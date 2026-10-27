/** One GLB's parsed JSON chunk and its BIN chunk. */
export interface GlbParts { readonly doc: Record<string, unknown>; readonly bin: Uint8Array }
/** Split a self-contained GLB into its JSON document and BIN chunk. */
export function split(bytes: Uint8Array): GlbParts;
/** The GLB with its embedded images removed (geometry only); it rewrites `source`'s document. */
export function geometry(source: GlbParts): Uint8Array;
/** The existing KTX2 bake of the first material's base or normal map. */
export function texture(model: GlbParts, slot: 'base' | 'normal'): Uint8Array;

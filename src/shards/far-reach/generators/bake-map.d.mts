/** Exact native model capabilities for the pure map source constructor. */
export const SKY_MAP_INPUTS: readonly string[];
/** Complete geometry/pose inputs for the existing raster publisher, with no filesystem reads. */
export function skyMapSources(native: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>>;

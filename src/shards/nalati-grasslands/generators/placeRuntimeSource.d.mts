/** Existing source records; callers own their defining data admission. */
export type PlaceRuntimeInput = 'data/campCatalogue.json' | 'data/places.json' | 'data/dressingGeos.json' | 'data/worldView.json' | 'data/modelMetrics.json' | 'data/staticCapture.json' | 'data/poiPaint.json';
/** Original runtime byte files without filesystem publication or a runtime binding. */
export function preparePlaceRuntime(read: (name: PlaceRuntimeInput) => unknown, encode: (value: unknown) => Uint8Array): ReadonlyMap<string, Uint8Array>;

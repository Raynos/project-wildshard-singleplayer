/** Existing source records; callers own their defining data admission. */
export type PlaceRuntimeInput = 'data/campCatalogue.json' | 'data/places.json' | 'dressing' | 'data/worldView.json' | 'data/modelMetrics.json' | 'data/staticCapture.json' | 'data/poiPaint.json';
/** Anonymous existing runtime rows; their defining consumers retain data admission. */
export interface PlaceRuntimeRows {
  readonly floors: readonly { readonly name: string; readonly bytes: Uint8Array }[];
  readonly runtime: unknown;
  readonly metrics: unknown;
  readonly capture: unknown;
  readonly shapeBook: unknown;
}
/** Prepare original row values and owned floor bytes, without file locators or JSON encoding. */
export function placeRuntimeRows(read: (name: PlaceRuntimeInput) => unknown, normalize: (value: unknown) => unknown): PlaceRuntimeRows;

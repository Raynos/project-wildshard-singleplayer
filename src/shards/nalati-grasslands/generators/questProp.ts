import type { PlaceGeometryRow } from './placeRows';

/** Original carried-prop metadata, parameterized by the caller-admitted material. */
export interface NalatiQuestProp<Material> {
  readonly key: 'prop';
  readonly model: { readonly id: string; readonly name: string; readonly category: 'props'; readonly pipeline: 'code';
    readonly file: string; readonly defaults: Record<string, never> };
  readonly source: { readonly kind: 'file'; readonly file: string; readonly geometry: PlaceGeometryRow; readonly material: Material };
}

/** Build the original carried-prop declaration from its computed carving geometry.
 * Callers retain specimen/material admission and binary publication. */
export function nalatiQuestProp<Material>(geometry: PlaceGeometryRow, material: Material): NalatiQuestProp<Material> {
  return {
    key: 'prop',
    model: { id: 'nalati-grasslands/kokpar-goat', name: 'Kokpar goat', category: 'props', pipeline: 'code',
      file: 'src/shards/nalati-grasslands/generators/carriedQuest.ts', defaults: {} },
    source: { kind: 'file', file: 'models/specimens/quest-prop.bin', geometry: structuredClone(geometry), material: structuredClone(material) },
  };
}

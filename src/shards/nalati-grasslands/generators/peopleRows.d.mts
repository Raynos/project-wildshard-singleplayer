import type { FigureAtlasRow } from '@wildshard/format/figures';

/** The camp's figure facts (bake-people.mjs writes them whole); typed here as the Explorer card reads them: each
 *  figure's own tiered merged atlas. */
export declare const peopleRows: {
  readonly figures: Readonly<Record<string, { readonly atlas: { readonly phone: FigureAtlasRow; readonly desktop: FigureAtlasRow } }>>;
};

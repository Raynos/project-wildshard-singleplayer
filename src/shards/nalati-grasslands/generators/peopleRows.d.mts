import type { FigureAtlasRow } from '@wildshard/format/figures';

/** The camp's figure facts (the chapter view carries them whole); typed here as the Explorer card and the camp's tests
 *  read them: the camp's tiered merged atlas and each figure's own. */
export declare const peopleRows: {
  readonly atlas: { readonly phone: FigureAtlasRow; readonly desktop: FigureAtlasRow };
  readonly figures: Readonly<Record<string, { readonly atlas: { readonly phone: FigureAtlasRow; readonly desktop: FigureAtlasRow } }>>;
};

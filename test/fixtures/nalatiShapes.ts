import { originalPoiPaintFiles } from './nalati-poi-paint-original';
import { fixedDraws } from '../../src/game/models/fixedDraws';
import shapeRows from './nalati-shape-book-original.json' with { type: 'json' };

/** Nalati's frozen original shape book (the product's models/shape-book.json) as one fixed-draw library,
 *  loaded once by test/setup.ts. */
const originals = originalPoiPaintFiles();
export const SHAPE_BYTES = new Map(shapeRows.sources.map(row => {
  const bytes = originals.get(row.source);
  if (bytes === undefined) throw new Error(`Missing original shape ${row.source}`);
  return [row.name, bytes] as const;
}));
export const SHAPES = fixedDraws({slug:'nalati-grasslands',file:name => {
  const bytes=SHAPE_BYTES.get(name);
  if(bytes===undefined)throw new Error(`Missing shape source ${name}`);
  return Promise.resolve(bytes);
}},shapeRows.draws);

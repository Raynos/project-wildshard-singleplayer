// oxlint-disable-next-line import/no-nodejs-modules -- Read the same retained blocks as the admitted product.
import { readFileSync } from 'node:fs';
import { fixedDraws } from '../../src/game/models/fixedDraws';
import shapeRows from './nalati-shape-book-original.json' with { type: 'json' };

/** Nalati's frozen original shape book (the product's models/shape-book.json) as one fixed-draw library,
 *  loaded once by test/setup.ts. */
export const SHAPE_BYTES = new Map(shapeRows.sources.map(row => [row.name,
  new Uint8Array(readFileSync(`src/shards/nalati-grasslands/${row.source}`))]));
export const SHAPES = fixedDraws({slug:'nalati-grasslands',file:name => {
  const bytes=SHAPE_BYTES.get(name);
  if(bytes===undefined)throw new Error(`Missing shape source ${name}`);
  return Promise.resolve(bytes);
}},shapeRows.draws);

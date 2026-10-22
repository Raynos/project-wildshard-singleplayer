import { bakedFixedDraws } from '../../src/game/models/fixedDraws';
import shapeRows from '../../src/shards/nalati-grasslands/data/shapeBook.generated.json' with { type: 'json' };

/** Nalati's shape book (data/shapeBook.generated.json, the product's models/shape-book.json) as one fixed-draw library,
 *  loaded once by test/setup.ts. */
export const SHAPES = bakedFixedDraws(shapeRows.draws);

import { bakedFixedDraws } from '@wildshard/game/models/fixedDraws';
import shapeRows from '../boot/shapeBook.generated.json' with { type: 'json' };

/** Nalati's prepared shapes (carvings, trophies, arena parts, ghost riders, painted places): fixed draws read from the
 *  place bake and inline rows (G600 L8); once loaded, `handle(key).copy()` is a fresh geometry. */
export const SHAPES = bakedFixedDraws(shapeRows.draws);

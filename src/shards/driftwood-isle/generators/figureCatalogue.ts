import * as v from 'valibot';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import castaway from '../data/castawayFigure.json' with { type: 'json' };
import trader from '../data/traderFigure.json' with { type: 'json' };

/** The same figure-row admission as skinned people, over the existing pivot kit. */
export const FIGURE_CATALOGUE = v.parse(FigureCatalogueSchema, { figures: {
  castaway: { phone: castaway, desktop: castaway }, trader: { phone: trader, desktop: trader },
} });

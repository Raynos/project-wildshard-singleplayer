import { driftwoodQuestFigures } from './questFigures';
import * as v from 'valibot';
import { KitFigureCardsSchema, type KitFigureCardsRows } from '@wildshard/format/questFigures';

/** The Explorer keeps the original own-space kit card, including the unlit
 * flames and the conditional borrowed smoke. Its explicit view owns its cold
 * fixed draws; the live composition continues borrowing its resident library. */
export function driftwoodKitFigureCards(): KitFigureCardsRows {
  const castaway = driftwoodQuestFigures().figures.find(row => row.id === 'castaway');
  if (castaway === undefined) throw new Error('Missing castaway card bindings');
  return v.parse(KitFigureCardsSchema, {
    catalogue: 'people/catalogue.json', draws: 'custom/fixedLayouts',
    cards: { castaway: {
      model: { id: 'driftwood-isle/castaway', name: 'Wendell, the castaway', category: 'people', pipeline: 'code',
        file: 'src/shards/driftwood-isle/generators/kitFigureCards.ts', surface: 'flesh', defaults: {} },
      figure: { ...castaway, feet: { poi: 'origin', x: 0, y: 0, z: 0, yaw: 0 }, fire: { poi: 'origin', x: -1.2, y: 0, z: -1.1 } },
    } },
  });
}

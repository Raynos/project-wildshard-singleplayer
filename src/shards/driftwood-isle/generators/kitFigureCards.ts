import { driftwoodQuestFigures } from './questFigures';
import type { QuestFigureRows } from '@wildshard/format/questFigures';

interface CardRows {
  readonly catalogue: string; readonly draws: string;
  readonly cards: { readonly castaway: { readonly model: { readonly id: string; readonly name: string; readonly category: 'people';
    readonly pipeline: 'code'; readonly file: string; readonly surface: 'flesh'; readonly defaults: Readonly<Record<string, never>> }; readonly figure: QuestFigureRows } };
}

/** The Explorer keeps the original own-space kit card, including the unlit
 * flames and the conditional borrowed smoke. Its explicit view owns its cold
 * fixed draws; the live composition continues borrowing its resident library. */
export function driftwoodKitFigureCards(): CardRows {
  const castaway = driftwoodQuestFigures().figures.find(row => row.id === 'castaway');
  if (castaway === undefined) throw new Error('Missing castaway card bindings');
  return {
    catalogue: 'people/catalogue.json', draws: 'custom/fixedLayouts',
    cards: { castaway: {
      model: { id: 'driftwood-isle/castaway', name: 'Wendell, the castaway', category: 'people', pipeline: 'code',
        file: 'src/shards/driftwood-isle/generators/kitFigureCards.ts', surface: 'flesh', defaults: {} },
      figure: { ...castaway, feet: { poi: 'origin', x: 0, y: 0, z: 0, yaw: 0 }, fire: { poi: 'origin', x: -1.2, y: 0, z: -1.1 } },
    } },
  };
}

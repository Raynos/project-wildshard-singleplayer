import { expect, test } from 'vitest';
import { atlasFigureCard } from '../src/game/models/kitFigureCard';
import { EXPLORER_CATALOGUE } from '../src/shards/nalati-grasslands/generators/explorerCatalogue';

test('the camp card retains the original public order, labels and one atlas per person', () => {
  const row = EXPLORER_CATALOGUE.entries.find(entry => entry.id === 'nalati-grasslands/camp-people');
  if (row?.kind !== 'kit-figure' || !('atlases' in row)) throw new Error('Expected the camp people atlas card');
  const card = atlasFigureCard(row);
  expect(card.defaults).toEqual({ figure: 'elder' });
  expect(card.variants).toEqual([
    { id: 'elder', label: 'Baqyt Ata, the elder', params: { figure: 'elder' } },
    { id: 'herderGate', label: 'Dauren, herder (corral gate)', params: { figure: 'herderGate' } },
    { id: 'herderRail', label: 'Erlan, herder (hitching rail)', params: { figure: 'herderRail' } },
    { id: 'child', label: 'Ayan, the child', params: { figure: 'child' } },
    { id: 'cook', label: 'Gulnar Apa, the cook', params: { figure: 'cook' } },
  ]);
  for (const [id, atlas] of Object.entries(row.atlases)) expect(atlas.desktop.joints).toEqual([`${id}-root`, `${id}-head`, `${id}-arm`]);
  expect(row).toMatchObject({ copies: 5, drawnAs: 'skinned', category: 'people' });
});

import { expect, test } from 'vitest';
import * as v from 'valibot';
import { QuestFigureSchema } from '../src/format/questFigures';
import { driftwoodKitFigureCards } from '../src/shards/driftwood-isle/generators/kitFigureCards';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };

test('the cold kit card keeps the live bindings but its original Explorer origin and fire', () => {
  const rows = driftwoodKitFigureCards(), card = rows.cards.castaway, live = driftwoodQuestFigures().figures[0];
  if (live === undefined) throw new Error('Missing live castaway');
  expect(rows.catalogue).toBe('people/catalogue.json'); expect(rows.draws).toBe('custom/fixedLayouts');
  expect(card.model).toEqual({ id: 'driftwood-isle/castaway', name: 'Wendell, the castaway', category: 'people', pipeline: 'code',
    file: 'src/shards/driftwood-isle/generators/kitFigureCards.ts', surface: 'flesh', defaults: {} });
  expect(v.parse(QuestFigureSchema, card.figure)).toEqual({ ...live,
    feet: { poi: 'origin', x: 0, y: 0, z: 0, yaw: 0 }, fire: { poi: 'origin', x: -1.2, y: 0, z: -1.1 } });
  const slots = new Set<string>(inventory.draws.map(draw => draw.slot));
  for (const slot of [...Object.values(card.figure.parts), ...card.figure.objects.map(row => row.draw), ...card.figure.publish.map(row => row.draw)]) expect(slots.has(slot)).toBe(true);
  expect(card.figure.objects.map(row => row.kind)).toEqual(['basic-mesh', 'cloud']);
  expect(card.figure.objects.find(row => row.kind === 'cloud')).toEqual(live.objects.find(row => row.kind === 'cloud'));
});

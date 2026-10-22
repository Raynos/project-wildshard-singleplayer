import { expect, test } from 'vitest';
import * as v from 'valibot';
import { KitFigureCardsSchema } from '../src/format/questFigures';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

function book() {
  const figure = driftwoodQuestFigures().figures[0];
  if (figure === undefined) throw new Error('Missing original figure');
  return { catalogue: 'people/catalogue.json', draws: 'custom/fixedLayouts', cards: { castaway: {
    model: { id: 'fixture/castaway', name: 'Castaway', file: 'fixture/generator.ts', category: 'people', pipeline: 'code', surface: 'flesh', defaults: {} },
    figure,
  } } };
}

test('kit cards emit the defining numeric figure and standard metadata as named JSON', () => {
  const input = book(), schema = namedJsonSchema(KitFigureCardsSchema), bytes = new TextEncoder().encode(JSON.stringify(input));
  expect(v.parse(KitFigureCardsSchema, validateNamedJsonSchema(schema, bytes))).toEqual(input);
});

test('kit card admission refuses ignored model knobs, reflected selectors and callbacks', () => {
  const rows = book(), card = rows.cards.castaway;
  for (const input of [
    { ...rows, draws: 'world.anything.fixedDraws' },
    { ...rows, cards: { castaway: { ...card, model: { ...card.model, defaults: { size: 3 } } } } },
    { ...rows, cards: { castaway: { ...card, model: { ...card.model, variants: [] } } } },
    { ...rows, cards: { castaway: { ...card, figure: { ...card.figure, run: () => undefined } } } },
    { ...rows, path: ['world', 'draws'] },
  ]) expect(() => v.parse(KitFigureCardsSchema, input)).toThrow();
});

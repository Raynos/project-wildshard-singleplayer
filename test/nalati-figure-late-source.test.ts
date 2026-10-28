import { expect, test } from 'vitest';
import { peopleRows } from '../src/shards/nalati-grasslands/generators/peopleRows.mjs';
import { EXPLORER_CATALOGUE } from '../src/shards/nalati-grasslands/generators/explorerCatalogue';
import { nalatiLateFigureNames } from '../src/shards/nalati-grasslands/generators/modelBindings';

const singles = ['child', 'cook', 'elder', 'herderGate', 'herderRail'].map(id => `models/people/${id}.glb`);

test('only individual Explorer variants defer; the live merged camp and original atlas images stay eager', () => {
  const before = structuredClone({ catalogue: EXPLORER_CATALOGUE, entered: peopleRows.atlas });
  const late = nalatiLateFigureNames(EXPLORER_CATALOGUE, peopleRows.atlas);
  expect(late).toEqual(singles);
  for (const tier of ['phone', 'desktop'] as const) {
    expect(peopleRows.atlas[tier].url).toBe('models/people/camp.glb');
    expect(late).not.toContain(peopleRows.atlas[tier].url);
    for (const url of peopleRows.atlas[tier].sources) expect(late).not.toContain(url);
  }
  expect({ catalogue: EXPLORER_CATALOGUE, entered: peopleRows.atlas }).toStrictEqual(before);
});

test('a shared entered atlas or non-atlas card cannot defer an early-play source', () => {
  const protectedFile = singles[0];
  expect(protectedFile).toBeDefined();
  expect(nalatiLateFigureNames(EXPLORER_CATALOGUE, { phone: { url: protectedFile }, desktop: peopleRows.atlas.desktop }))
    .toEqual(singles.slice(1));
  expect(nalatiLateFigureNames({ entries: [{ kind: 'held', atlases: { phone: { url: protectedFile } } }] }, {})).toEqual([]);
  expect(nalatiLateFigureNames({}, peopleRows.atlas)).toEqual([]);
});

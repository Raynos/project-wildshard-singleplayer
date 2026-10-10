import { expect, it } from 'vitest';
import { AQBARS_BRAIN, KOKBORI_BRAIN } from '../../../src/shards/nalati-grasslands/runtime/eliteBrains';
import { QYRAN_BRAIN } from '../../../src/shards/nalati-grasslands/runtime/qyranData';
import { EAGLE_DATA } from '../../../src/shards/nalati-grasslands/data/species/eagle';
import { EAGLE_SPECIES } from '../../../src/shards/nalati-grasslands/species/eagle';
import { LEOPARD_DATA } from '../../../src/shards/nalati-grasslands/data/species/leopard';
import { KOKBORI_DATA } from '../../../src/shards/nalati-grasslands/data/species/kokbori';
import { KOKBORI_SPECIES } from '../../../src/shards/nalati-grasslands/species/kokbori';
import { LEOPARD_SPECIES } from '../../../src/shards/nalati-grasslands/species/leopard';
import { nalatiRow } from '../../../src/shards/nalati-grasslands/species/rows';

it('declares the actual page leopard body data, with one pouncer brain and no view or duplicate actor recipe', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(LEOPARD_SPECIES);
  expect(row).toEqual(LEOPARD_DATA);
  expect(AQBARS_BRAIN.archetype).toBe('ledge-pouncer');
});

it('shares Kokbori body gameplay and exact declared pack policy with the actual page species', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(KOKBORI_SPECIES);
  expect(row).toEqual(KOKBORI_DATA); expect(KOKBORI_BRAIN.archetype).toBe('pack-howler');
});

it('shares the actual eagle body gameplay and one strict wind-stooper row without a view or duplicate spawn recipe', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(EAGLE_SPECIES);
  expect(row).toEqual(EAGLE_DATA); expect(QYRAN_BRAIN.archetype).toBe('wind-stooper');
});

import { expect, it } from 'vitest';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import { NALATI_ELITE_SPECIES, AQBARS_BRAIN, KOKBORI_BRAIN } from '../../../src/shards/nalati-grasslands/data/eliteBrains';
import { LEOPARD_DATA } from '../../../src/shards/nalati-grasslands/data/species/leopard';
import { KOKBORI_DATA } from '../../../src/shards/nalati-grasslands/data/species/kokbori';
import { KOKBORI_SPECIES } from '../../../src/shards/nalati-grasslands/species/kokbori';
import { LEOPARD_SPECIES } from '../../../src/shards/nalati-grasslands/species/leopard';
import { nalatiRow } from '../../../src/shards/nalati-grasslands/species/rows';

it('declares the actual page leopard body data, with one pouncer brain and no view or duplicate actor recipe', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(LEOPARD_SPECIES);
  expect(row).toEqual(LEOPARD_DATA);
  expect(NALATI_ELITE_SPECIES).toEqual([{ ...LEOPARD_DATA, brain: AQBARS_BRAIN }, { ...KOKBORI_DATA, brain: KOKBORI_BRAIN }]);
  expect([...speciesBrains(NALATI_ELITE_SPECIES, []).kinds]).toEqual(['leopard', 'kokbori']);
  expect(AQBARS_BRAIN.archetype).toBe('ledge-pouncer');
});

it('shares Kokbori body gameplay and exact declared pack policy with the actual page species', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(KOKBORI_SPECIES);
  expect(row).toEqual(KOKBORI_DATA);
});

import { expect, it } from 'vitest';
import { AQBARS_PROFILE, KOKBORI_PROFILE, AQBARS_BRAIN, KOKBORI_BRAIN } from '../../../src/shards/nalati-grasslands/data/eliteProfiles';
import { QYRAN_PROFILE, QYRAN_BRAIN } from '../../../src/shards/nalati-grasslands/data/qyranProfile';
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
  expect(AQBARS_PROFILE).toEqual({ kind: 'stalker', pattern: 'pouncer', spec: AQBARS_BRAIN.data });
  expect(AQBARS_PROFILE.spec).toBe(AQBARS_BRAIN.data);
});

it('shares Kokbori body gameplay and exact declared pack policy with the actual page species', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(KOKBORI_SPECIES);
  expect(row).toEqual(KOKBORI_DATA); expect(KOKBORI_BRAIN.archetype).toBe('pack-howler');
  expect(KOKBORI_PROFILE).toEqual({ kind: 'stalker', pattern: 'howler', spec: KOKBORI_BRAIN.data });
  expect(KOKBORI_PROFILE.spec).toBe(KOKBORI_BRAIN.data);
});

it('shares the actual eagle body gameplay and one strict wind-stooper row without a view or duplicate spawn recipe', () => {
  const { think: _think, act: _act, ...row } = nalatiRow(EAGLE_SPECIES);
  expect(row).toEqual(EAGLE_DATA); expect(QYRAN_BRAIN.archetype).toBe('wind-stooper');
  expect(QYRAN_PROFILE).toEqual({ kind: 'diver', pattern: 'wind', spec: QYRAN_BRAIN.data });
  expect(QYRAN_PROFILE.spec).toBe(QYRAN_BRAIN.data);
});

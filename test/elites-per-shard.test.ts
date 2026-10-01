import { expect, it } from 'vitest';
import { elitesSave, shardSave } from '#game/saves';

it('keeps the same elite id independent in Nalati and Pine Hollow', () => {
  const pine = shardSave(elitesSave, 'pine-hollow'), nalati = shardSave(elitesSave, 'nalati-grasslands');
  const state = { timer: 25, discovered: true, skinTaken: true, kills: 2, retired: true };
  pine.write({ stag: state });
  expect(nalati.read()).toEqual({});
  nalati.write({ stag: { ...state, kills: 7, retired: false } });
  expect(pine.read()['stag']).toEqual(state);
  expect(nalati.read()['stag']?.kills).toBe(7);
});

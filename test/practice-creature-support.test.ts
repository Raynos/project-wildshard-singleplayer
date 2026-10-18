import { expect, test, vi } from 'vitest';
import { app } from '../src/engine/app/runtime';
import { registeredSpecies } from '../src/engine/entities/species/registry';
import { practiceCreatureSupport } from '../src/game/practice/PracticeCreature';
import { DRIFTWOOD_ENEMY_SPECIES } from '../src/shards/driftwood-isle/generators/enemySpecies';
import type { BrainedSpecies } from '../src/game/plugin/brain';

function row(kind: string): BrainedSpecies {
  const species = DRIFTWOOD_ENEMY_SPECIES.find(value => value.kind === kind);
  if (species === undefined) throw new Error('Missing authored species');
  return species;
}

test('admits the authored grounded attack body only when its level appearance is resident', () => {
  const species = row('crab');
  vi.spyOn(app.species, 'get').mockReturnValue(undefined);
  expect(practiceCreatureSupport(species, 'small')).toEqual({ supported: false, reason: 'The creature and its look are not loaded in this level.' });
  vi.spyOn(app.species, 'get').mockReturnValue(registeredSpecies('crab'));
  expect(practiceCreatureSupport(species, 'small')).toEqual({ supported: true });
  expect(practiceCreatureSupport(species, 'big')).toEqual({ supported: true });
  expect(practiceCreatureSupport(species, 'not-a-variant').supported).toBe(false);
});

test('refuses unsupported decisions, absent attack authority and flight without substituting an AI', () => {
  const species = row('crab');
  expect(practiceCreatureSupport(row('monkey'), 'monkey').supported).toBe(false);
  expect(practiceCreatureSupport(row('sailor'), 'sailor').supported).toBe(false);
  const { body: _body, ...withoutBody } = species;
  expect(practiceCreatureSupport(withoutBody, 'small').supported).toBe(false);
  expect(practiceCreatureSupport({ ...species, flight: { altitude: 2, above: 'ground', climbRate: 1, diveRate: 1 } }, 'small').supported).toBe(false);
});

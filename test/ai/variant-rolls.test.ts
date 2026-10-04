import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/engine/core/rng';
import { rollVariant, speciesDef } from '../../src/engine/entities/species/registry';
import { loadSpecies } from '../species';

loadSpecies();
describe('variant random-stream parity', () => {
  it('retains seeded rolls and the legendary reroll random consumption', () => {
    const rolls = Object.fromEntries(['boar', 'bear', 'deer', 'elk'].map((kind) => {
      const rng = new Rng(1337), species = speciesDef(kind);
      return [kind, [false, true].map((exclude) => ({
        exclude, variants: Array.from({ length: 64 }, () => rollVariant(species, rng, undefined, exclude).id), next: rng.next(),
      }))];
    }));
    expect(rolls).toMatchSnapshot('seed 1337 before WeightedTable');
  });
});

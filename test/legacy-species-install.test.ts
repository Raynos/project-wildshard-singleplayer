import { expect, test } from 'vitest';
import type { SpeciesDef } from '../src/engine/entities/species/registry';
import { Rng } from '../src/engine/core/rng';
import { MANIFEST as pine } from '../src/shards/pine-hollow/discovery.generated';
import { installKitSpecies, installLegacyKitSpecies } from '../src/game/systems/species/install';

function catalogue() {
  const rows: SpeciesDef[] = [];
  return { rows, register: (row: SpeciesDef): SpeciesDef => { rows.push(row); return row; } };
}

test('modern Pine and ordinary model tools do not register legacy deer or elk', () => {
  const { rows, register } = catalogue();
  expect(pine.legacy).not.toBe(true);
  installKitSpecies(register);
  expect(rows.map(row => row.kind)).toEqual(['boar', 'bear']);
});

test('an explicit legacy boot restores original registration order and real procedural bodies', async () => {
  const { rows, register } = catalogue();
  await installLegacyKitSpecies(register);
  expect(rows.map(row => row.kind)).toEqual(['boar', 'deer', 'elk', 'bear']);
  for (const kind of ['deer', 'elk']) {
    const species = rows.find(row => row.kind === kind), variant = species?.variants[0];
    if (species === undefined || variant === undefined) throw new Error('Missing original species');
    const body = species.build(variant, new Rng(357));
    const geometry = [...body.furParts, ...body.hardParts, ...body.eyeParts];
    try {
      expect(geometry.length).toBeGreaterThan(0);
      for (const part of geometry) expect(part.getAttribute('position').count).toBeGreaterThan(0);
      expect(body.bones.map(bone => bone.name)).toEqual(expect.arrayContaining(['body', 'head']));
      expect(body.dims.bodyHalfLen).toBeGreaterThan(0);
    } finally { for (const part of geometry) part.dispose(); }
  }
});

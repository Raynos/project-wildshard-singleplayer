import { expect, test } from 'vitest';
import { currentDressingScene, dressingScene } from './fixtures/nalati-dressing-scene';
import { nalatiDecorative } from './fixtures/nalati-decorative';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiBalbal } from './fixtures/nalati-balbal';
import { nalatiSpecimens } from './fixtures/nalati-specimens';

for (const tier of ['phone', 'desktop'] as const) test(`${tier} changes only the crag's defining producer pointer`, () => {
  const current = currentDressingScene(tier, nalatiDecorative, nalatiRuntime, nalatiBalbal, nalatiSpecimens);
  const before = dressingScene(tier, nalatiDecorative, nalatiRuntime, nalatiBalbal, nalatiSpecimens);
  const models = current.staticModels.filter(row => row.model.id === 'nalati-grasslands/crag-rock');
  expect(models).toHaveLength(1);
  const row = models[0], old = before.staticModels.find(model => model.model.id === 'nalati-grasslands/crag-rock');
  if (row === undefined || old === undefined) throw new Error('Missing native crag provenance');
  expect(row.model.file).toBe('src/shards/nalati-grasslands/generators/cragRockProgram.ts');
  const currentBytes = new TextEncoder().encode(JSON.stringify(current));
  row.model.file = old.model.file;
  expect(JSON.stringify(current)).toBe(JSON.stringify(before));
  expect(currentBytes.byteLength).toBe(new TextEncoder().encode(JSON.stringify(before)).byteLength);
});

import { expect, test } from 'vitest';
import { tierLibrarySteps } from '../src/format/tierSelection';
import { fixedDraws } from '../src/game/models/fixedDraws';
import { driftwoodFixedModelOutput } from '../src/shards/driftwood-isle/generators/fixedModels';
import { GULL_DRAW } from '../src/shards/driftwood-isle/generators/gullDraw';
import { FISH_DRAW } from '../src/shards/driftwood-isle/generators/fishDraw';
import { driftwoodFixedFiles } from './fixtures/driftwoodSceneBanks';

test('whole-covered fixed files leave phone play but stay available to posed and no-owner readers', async () => {
  const native = await driftwoodFixedFiles();
  const emitted = await driftwoodFixedModelOutput({ cached: () => Promise.resolve(native) });
  const independent = new Set([GULL_DRAW, FISH_DRAW].map(row => row.tiers.phone.geometry));
  const source = { identity: { slug: 'fixed-selection' }, files: emitted.files,
    library: emitted.files.map(file => file.hash), critical: [] };
  const descriptor = { index: { files: emitted.files }, sections: new Map<string, unknown>([
    ['custom/fixedLayouts', { draws: emitted.files.map(file => ({ file: file.name })) }],
  ]) };
  const steps = tierLibrarySteps(source, 'phone', descriptor);
  let step = steps.next(); while (step.done !== true) step = steps.next();
  expect(emitted.files).toHaveLength(90);
  expect(emitted.files.filter(file => !step.value.has(file.hash)).map(file => file.name).sort((a, b) => (a ?? '').localeCompare(b ?? '')))
    .toEqual([...independent].sort((a, b) => a.localeCompare(b)));
  const fallback = emitted.files.find(file => file.tier === 'desktop');
  if (fallback?.name === undefined) throw new Error('Missing covered fixed file');
  // Selection schedules entry traffic; it neither deletes the original named
  // file nor replaces a cold/no-owner read with a whole-world constructor.
  const reads: string[] = [];
  const draws = fixedDraws({ slug: source.identity.slug, file: name => {
    reads.push(name);
    const row = emitted.files.find(file => file.name === name), bytes = row === undefined ? undefined : emitted.assets.get(row.hash);
    if (bytes === undefined) throw new Error('Missing original named geometry');
    return Promise.resolve(bytes);
  } }, [{ slot: 'fallback', file: fallback.name, channels: [] }]);
  await draws.load();
  expect(draws.ready).toBe(true);
  expect(reads).toEqual([fallback.name]);
  const geometry = draws.handle('fallback').take();
  try { expect(geometry.getAttribute('position').count).toBeGreaterThan(0); } finally { geometry.dispose(); }
});

import { expect, test } from 'vitest';
import type { AuthorWorldScenes } from '@wildshard/sdk/worldScenes';
import { nineRefinementFiles } from './refinementAdmission';

test('only exclusive refinement files leave the upfront library, with stable deduplicated hashes', () => {
  const shared = 'a'.repeat(64), first = 'b'.repeat(64), last = 'c'.repeat(64), cold = 'd'.repeat(64);
  const libraries: AuthorWorldScenes['libraries'] = [
    { id: 'fine', kind: 'whole', load: 'refine', models: [{ id: 'one', part: 'one', files: [last, shared, first] }, { id: 'two', part: 'two', files: [last] }] },
    { id: 'early', kind: 'whole', models: [{ id: 'start', part: 'start', files: [shared] }] },
    { id: 'cold', kind: 'whole', load: 'explorer', models: [{ id: 'menu', part: 'menu', files: [cold, first] }] },
  ];
  const original = structuredClone(libraries);
  expect(nineRefinementFiles(libraries)).toEqual([{ hash: first }, { hash: last }]);
  expect(libraries).toEqual(original);
  expect(nineRefinementFiles([...libraries].reverse())).toEqual([{ hash: first }, { hash: last }]);
});

test('ordinary and cold-only catalogues keep the existing admission policy', () => {
  const libraries: AuthorWorldScenes['libraries'] = [
    { id: 'ordinary', kind: 'whole', models: [{ id: 'one', part: 'one', files: ['a'.repeat(64)] }] },
    { id: 'cold', kind: 'whole', load: 'explorer', models: [{ id: 'two', part: 'two', files: ['b'.repeat(64)] }] },
  ];
  expect(nineRefinementFiles(libraries)).toEqual([]);
});

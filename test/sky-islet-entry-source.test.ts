import { expect, test } from 'vitest';
import { risingIsletRows, risingIsletSource, risingIsletEntryways } from '../src/shards/far-reach/generators/risingIslets';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { discoverGeneration } from '../scripts/generate.mjs';

test('source entry rows retain both complete original transports and detach every caller', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(risingIsletRows())}\n`);
  expect(bytes().byteLength).toBe(9_137);
  expect(hashImmutableBytes(bytes())).toBe('ac1762788cb392151c16285dab616053b7403f443a0cccbd0634f396c9200b2c');
  expect(risingIsletSource().byteLength).toBe(6_566);
  expect(hashImmutableBytes(risingIsletSource())).toBe('568c5f8d7c466a810a0c34a3c43c5a125641652ac16ef469e5478358027b2e3e');
  const first = risingIsletRows().entries[0];
  if (first === undefined) throw new Error('Missing original entry');
  Reflect.set(first.isle, 'x', first.isle.x + 1); first.strips.splice(0); Reflect.set(first.lift.route, 'length', 0);
  const entry = risingIsletEntryways()[0];
  if (entry === undefined) throw new Error('Missing original socket lift');
  entry.at.fill(0); entry.lift.route.splice(0);
  expect(hashImmutableBytes(bytes())).toBe('ac1762788cb392151c16285dab616053b7403f443a0cccbd0634f396c9200b2c');
  expect(hashImmutableBytes(risingIsletSource())).toBe('568c5f8d7c466a810a0c34a3c43c5a125641652ac16ef469e5478358027b2e3e');
});

test('entry readers precede retirement of both scheduler transports', () => {
  const { jobs } = discoverGeneration('.');
  for (const id of ['sky-rising-islets', 'sky-islet-source']) expect(jobs.some(job => job.id === id)).toBe(false);
  for (const job of jobs) {
    expect(job.inputRoots, job.id).not.toContain('src/shards/far-reach/data/islets.generated.json');
    expect(job.inputRoots, job.id).not.toContain('src/shards/far-reach/generators/rows/islets.generated.ts');
  }
});

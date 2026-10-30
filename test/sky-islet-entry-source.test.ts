import { expect, test } from 'vitest';
import { risingIsletRows, risingIsletSource, risingIsletEntryways } from '../src/shards/far-reach/generators/risingIslets';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('source entry rows detach every caller from both complete current transports', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(risingIsletRows())}\n`);
  const expectedRows = hashImmutableBytes(bytes()), expectedSource = hashImmutableBytes(risingIsletSource());
  const first = risingIsletRows().entries[0];
  if (first === undefined) throw new Error('Missing original entry');
  Reflect.set(first.isle, 'x', first.isle.x + 1); first.strips.splice(0); Reflect.set(first.lift.route, 'length', 0);
  const entry = risingIsletEntryways()[0];
  if (entry === undefined) throw new Error('Missing original socket lift');
  entry.at.fill(0); entry.lift.route.splice(0);
  expect(hashImmutableBytes(bytes())).toBe(expectedRows);
  expect(hashImmutableBytes(risingIsletSource())).toBe(expectedSource);
});

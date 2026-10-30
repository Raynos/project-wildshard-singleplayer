import { expect, test } from 'vitest';
import { REEF_FILES, reefFilesFrom } from '../src/shards/driftwood-isle/generators/reefFiles';
import { driftwoodReefBank } from '../src/shards/driftwood-isle/generators/reefBank';
import { hashImmutableBytes } from '../src/sdk/immutable';

const original = (hash: string, kind: string): string => {
  const root = '/assets/driftwood-isle/baked/';
  return `${root}reef-${hash}.${kind}`;
};
test('owned reef aliases retain every original content identity and choice', () => {
  const bank = driftwoodReefBank();
  for (const [url, name] of Object.entries(bank.byUrl)) {
    const blob = bank.blobs.get(name);
    if (blob === undefined) throw new Error(`Missing owned reef blob: ${name}`);
    expect(url).toBe(original(hashImmutableBytes(blob.bytes), blob.kind));
  }
});

test('reef alias admission refuses missing and duplicate owned content', () => {
  const byUrl = { ...driftwoodReefBank().byUrl }, url = REEF_FILES.coral.default;
  const name = byUrl[url];
  if (name === undefined) throw new Error('Missing original reef alias');
  delete byUrl[url];
  expect(() => reefFilesFrom(byUrl)).toThrow('needs one owned alias');
  byUrl[url] = name;
  byUrl[`/duplicate${url}`] = name;
  expect(() => reefFilesFrom(byUrl)).toThrow('needs one owned alias');
});

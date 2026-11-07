import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePin, SHARDS } from '../scripts/engine-pin.mjs';
const pin = () => ({ schema: 1, engine: { repo: 'engine', tag: 'v0.1.1', commit: 'a'.repeat(40) }, saveEpoch: 1, shards: SHARDS.map(repo => ({ repo, commit: 'b'.repeat(40) })) });
test('release pin requires epoch one and all seven immutable shard installs', () => {
  assert.equal(validatePin(pin()).shards.length, 7);
  assert.throws(() => validatePin({ ...pin(), saveEpoch: 0 }));
  assert.throws(() => validatePin(pin(), 2));
  assert.throws(() => validatePin({ ...pin(), shards: pin().shards.slice(1) }));
  assert.throws(() => validatePin({ ...pin(), shards: [...pin().shards.slice(1), pin().shards[1]] }));
  assert.throws(() => validatePin({ ...pin(), engine: { ...pin().engine, commit: 'main' } }));
});

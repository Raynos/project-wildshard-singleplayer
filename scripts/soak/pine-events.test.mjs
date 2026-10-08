import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePineAllocations } from './pine-events.mjs';

void test('Pine allocation summary distinguishes a live peak from repeated storage calls and excludes later recovery allocations', () => {
  const allocation = (at, id, bytes) => ({ document: 'first', op: 'allocation', kind: 'texture', at, id, bytes });
  const events = [allocation(1, 'a', 64), { document: 'first', op: 'label', at: 1, id: 'a', owner: 'pine', asset: 'rock' },
    allocation(2, 'a', 128), allocation(3, 'b', 256), allocation(4, 'a', null), { document: 'first', op: 'end', at: 5 },
    { ...allocation(7, 'later', 99999), document: 'recovery' }];
  const uploads = [1, 2, 3].map(at => ({ at, bytes: 128, operation: 'texImage2D' }));
  const native = [{ type: 'sample', t: new Date(4000).toISOString(), gpu: 100, processIdentities: { gpu: { 7: { startAbstime: 123 } } } }];
  const result = summarizePineAllocations(events, uploads, native, 6);
  assert.equal(result.apiPeak.bytes, 384); assert.equal(result.apiPeak.at, 3);
  const labelled = result.apiPeak.largest.find(row => row.id === 'a'); assert.ok(labelled);
  assert.equal(labelled.asset, 'rock');
  assert.equal(result.largestGrowth[0].increaseBytes, 256);
  assert.equal(result.lastFiveSeconds.reduce((sum, row) => sum + row.storageCalls, 0), 3);
  assert.equal(result.lastFiveSeconds.reduce((sum, row) => sum + row.touchedFootprintBytes, 0), 384);
  assert.equal(result.nativeNearEvent[0].gpuBytes, 100); assert.equal(result.nativeNearEvent[0].identities.gpu[7].startAbstime, 123);
});

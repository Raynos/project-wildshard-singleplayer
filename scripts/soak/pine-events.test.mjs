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

void test('successful settled entries retain their earlier sliding burst and exclude the cold boot', () => {
  const row = (at, id, bytes) => ({ at, id, bytes, document: 'game', op: 'allocation', kind: 'buffer', operation: 'bufferData', stage: 'travel' });
  const events = [row(1, 'boot', 10000), row(2, 'boot', 5000), row(10.8, 'first', 100), row(11.1, 'second', 200), row(11.9, 'third', 50), row(12, 'second', null)];
  const uploads = [row(1, 'boot', 10000), row(10.8, 'first', 100), { ...row(11.1, 'second', 200), callSite: 'composer render' }, row(11.2, 'second', 200)];
  const result = summarizePineAllocations(events, uploads, [], 40, 10);
  assert.equal(result.entryOneSecondGrowth.bytes, 300);
  assert.equal(result.entryOneSecondGrowth.count, 2);
  assert.equal(result.entryOneSecondGrowth.from, 10.8);
  assert.equal(result.entryOneSecondGrowth.through, 11.1);
  assert.equal(result.entryOneSecondStorageFootprints.bytes, 500, 'Repeated calls count in touched footprints only');
  assert.equal(result.entryOneSecondStorageCalls.count, 3);
  assert.equal(result.lastFiveSeconds.length, 0, 'Final settle window is distinct from the upload burst');
  assert.equal(result.entryCallSites[0].callSite, 'composer render');
  assert.equal(result.apiPeak.bytes, 10000, 'Whole-page boot peak is reported independently');
  assert.deepEqual(result.entryApiPeak, { bytes: 5350, at: 11.9 });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPineEntry } from './pine-rate.mjs';

void test('Pine rate counts actual connected-game entry losses and separates boot, teardown and unknown navigation', () => {
  const loss = { kind: 'contextlost', gameCanvas: true, target: { connected: true }, at: 10 };
  const good = { driveStarted: 'now', diagnosticEntry: { instance: 'pine-hollow', settledSeconds: 20, at: 20 }, routes: [{ failures: [] }] };
  assert.equal(classifyPineEntry(good).entryCompleted, true);
  assert.equal(classifyPineEntry({ ...good, diagnostics: [loss] }).entryLoss, true);
  assert.equal(classifyPineEntry({ diagnostics: [loss] }).bootLoss, true);
  assert.equal(classifyPineEntry({ ...good, diagnostics: [{ ...loss, at: 21 }], failure: 'teardown' }).entryCompleted, true);
  assert.equal(classifyPineEntry({ ...good, diagnostics: [{ ...loss, at: 21 }], failure: 'teardown' }).teardownFailure, 'teardown');
  for (const changed of [{ gameCanvas: false }, { target: { connected: false } }]) {
    assert.equal(classifyPineEntry({ driveStarted: 'now', diagnostics: [{ ...loss, ...changed }] }).entryLoss, false);
  }
  const unknown = classifyPineEntry({ driveStarted: 'now', failure: 'Document changed without actual loss evidence' });
  assert.equal(unknown.entryLoss, false); assert.equal(unknown.entryCompleted, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSoakGl } from './gl.mjs';

void test('SF57 preserves labelled GL allocations, reconciliation and allocator telemetry each second', () => {
  const oldWindow = globalThis.window, oldInterval = globalThis.setInterval;
  let tick, lost;
  const contexts = [{ totalBytes: 100, texBytes: 60, rbBytes: 30, bufBytes: 10, unlabelled: 0, reconciled: true,
    resources: [{ owner: 'template-1', asset: 'model:a', bytes: 60 }, { owner: 'template-1', asset: 'model:a', bytes: 10 }] }];
  try {
    globalThis.setInterval = (callback, period) => { assert.equal(period, 1000); tick = callback; return 1; };
    globalThis.window = { __sc_gl: () => contexts, __sf57Errors: [], __sf57: { cycles: 2 },
      __wildshard: { shard: { grid: { state: () => ({ accountedBytes: 400_000_000, rings: { inFlight: 0, queued: 0 }, live: { live: { pending: [], gameplayReady: true } } }) } } },
      addEventListener: (name, listener) => { assert.equal(name, 'webglcontextlost'); lost = listener; } };
    installSoakGl(); tick();
    const row = window.__sf57GL[0];
    assert.equal(row.totalBytes, 100); assert.equal(row.accountedBytes, 400_000_000); assert.equal(row.cycle, 2);
    assert.deepEqual(row.assets, [{ owner: 'template-1', asset: 'model:a', bytes: 70, resources: 2 }]);
    assert.equal(row.reconciled, true); contexts[0].reconciled = false; contexts[0].unlabelled = 1; tick();
    assert.equal(window.__sf57GL[1].reconciled, false); assert.equal(window.__sf57GL[1].unlabelled, 1);
    contexts[0].totalBytes = 0; tick(); assert.equal(window.__sf57GL[2].totalBytes, 0);
    lost(); assert.deepEqual(window.__sf57Errors, ['WebGL context lost']);
  } finally { globalThis.window = oldWindow; globalThis.setInterval = oldInterval; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSoakDrive } from './drive.mjs';

void test('SF57 counts a real interior event, not admission at the strip or a proxy, and stops after 30 real minutes', () => {
  const oldWindow = globalThis.window, oldPerformance = globalThis.performance;
  let clock = 0, frame, stopped = 0, clears = 0;
  const grid = { inside: null, live: { live: { current: 'template-1', residents: ['template-1'], worldFeet: { x: 0, z: -255 }, issues: {} } } };
  const world = { player: { setHover: () => undefined, yaw: 0 }, game: { app: { input: { clear: () => { clears++; }, setHeld: () => undefined } },
    watchFrames: (observer) => { frame = observer; return () => { stopped++; }; } } };
  try {
    globalThis.performance = { now: () => clock };
    globalThis.window = { __wildshard: { world, shard: { grid: { state: () => grid } } } };
    installSoakDrive({ steps: [{ kind: 'enter', instance: 'template-1', x: 0, z: -225 }] }, 1800);
    frame(); assert.equal(window.__sf57.events.filter((event) => event.type === 'entry').length, 0);
    clock = 100; grid.inside = 'template-1'; grid.live.live.worldFeet.z = -245;
    frame(); frame();
    assert.equal(window.__sf57.events.filter((event) => event.type === 'entry' && event.admitted).length, 1);
    clock = 1800001; frame();
    assert.equal(window.__sf57.done, true); assert.equal(stopped, 1); assert.ok(clears > 0);
  } finally { globalThis.window = oldWindow; globalThis.performance = oldPerformance; }
});

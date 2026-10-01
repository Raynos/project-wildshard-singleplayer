#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { capture } from './parity.mjs';
import { STEPS } from './parity/combat.mjs';
import { browserPool } from './parity/pool.mjs';
import { assertMetal } from './parity/fingerprint.mjs';
import { flatten, object, array } from './parity/value.mjs';

const url = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6);
if (!url) throw new Error('usage: node scripts/test-template-gate.mjs --url=<built preview> [--out=<directory>]');
const out = resolve(process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ?? 'parity-out/template');
mkdirSync(out, { recursive: true });
const fixture = mkdtempSync(join(tmpdir(), 'template-gate-'));
mkdirSync(join(fixture, 'scripts'));
writeFileSync(join(fixture, 'scripts/physics-route.json'), JSON.stringify({ _template: [{ name: 'hut', gate: true,
  start: { x: 0, y: 1, z: 0, yaw: 0 }, waypoints: [{ x: 0, z: -4 }, { x: 0, z: -7.5 }], timeout: 30 }] }));
STEPS._template = [{ step: 'swing', weapon: 'template-whip', target: 'greyBlob', near: { x: 0, z: -19 }, distance: 3, hit: 5, kill: 20 }];
const pool = browserPool(resolve(import.meta.dirname, '..'), 1, 'metal');
try {
  const browser = await pool.browser(0); await assertMetal(browser, 'metal');
  const result = object(await capture(browser, url, { shard: '_template', tier: 'phone', lane: 'gh-macos15', sha: '', root: fixture,
    out, timeout: 240, full: false, only: 'walk+combat+leak', offline: false, accelerated: true, telemetryFixture: true }));
  writeFileSync(join(out, 'gate.json'), JSON.stringify(result, null, 2));
  assert.deepEqual(object(result.boot).errors, [], 'template boot');
  const walk = object(result.walk); assert.equal(walk.stuck, 0, 'hut walk'); assert.equal(array(walk.legs).length, 1, 'hut route ran');
  assert.equal(object(object(result.combat).swing).killed, true, 'custom whip killed the blob');
  const leak = object(result.leak); assert.deepEqual(leak.disposalErrors, [], 'scope disposal');
  const before = flatten(leak.before), after = flatten(leak.after);
  const changes = Object.keys(before).filter((key) => before[key] !== after[key]);
  assert.deepEqual(changes, [], 'independent resource census returns to baseline');
  console.log('Template phone: clean boot, hut walk, blob kill, unload census');
} finally { await pool.close(); rmSync(fixture, { recursive: true, force: true }); }

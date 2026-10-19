import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { admitSharedArena, pins, digest } from './admission.mjs';

const root = process.cwd(), source = process.env.SHARED_ARENA_HOSTS;
if (!source) throw new Error('SHARED_ARENA_HOSTS must name the exact retained hosts');
await test('all four exact tested tuples pass source and byte admission', () => {
  assert.deepEqual(admitSharedArena(root, source).map(row=>row.id), ['mantis','conch','colossus','puffer']);
});
await test('one altered pinned digest fails closed; Bellback has no admission', () => {
  const pin = pins.enemies.mantis, path = Object.keys(pin.files)[0], original = pin.files[path];
  try { pin.files[path] = '0'.repeat(64); assert.throws(()=>admitSharedArena(root,source),/pin mismatch/); }
  finally { pin.files[path] = original; }
  assert.equal(pins.enemies.bellback, undefined);
});
await test('the shared runtime retains actor-owned timing, damage and products without cap exemptions', () => {
  const code = readFileSync(new URL('../../practice/shared-arena/runtime.ts',import.meta.url),'utf8');
  assert.match(code,/product: choice.product/); assert.match(code,/strikes: choice.strikes/);
  assert.match(code,/new EncounterSession/); assert.match(code,/encounter.exit\(\)/);
  assert.doesNotMatch(code,/capExempt|\.mem\[.*\]\s*=|localStorage|indexedDB|caches\.open/);
  assert.equal((code.match(/new Game\(/g)??[]).length,1);
  assert.equal((code.match(/new TrainingArena\(/g)??[]).length,1);
  assert.equal(digest(readFileSync('src/pufferGaitContinuityPreview.ts')), '54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d');
});

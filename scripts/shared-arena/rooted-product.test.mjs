import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { admitRootedPitcher, verifyRootedLifecycleDecision, PITCHER_LIFECYCLE_CHECKS } from './rooted-product.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// Deliberately not a real Pitcher identity. These are parser fixtures, not admission.
const identity = { fixtureOnly: 'not-an-enemy-or-host' };
function fixture(run) {
  const dir = mkdtempSync(resolve('tmp/rooted-adapter-unit-'));
  const put = (path, value) => { const bytes = JSON.stringify(value); writeFileSync(resolve(dir, path), bytes); return { path, sha256: sha(bytes) }; };
  const evidence = { synthetic: false, complete: true, identity, checks: Object.fromEntries(PITCHER_LIFECYCLE_CHECKS.map(key => [key, 'passed'])) };
  const lifecycle = put('fixture-lifecycle.json', evidence);
  const review = { synthetic: false, verdict: 'approved', identity, lifecycleSha256: lifecycle.sha256 };
  const decision = { schema: 'wildshard.shared-arena.rooted-admission.v1', synthetic: false, admitted: true, scope: 'shared-arena', completeLifecycle: true, identity, lifecycle, independentReview: put('fixture-review.json', review) };
  try { run({ dir, put, evidence, review, decision }); } finally { rmSync(dir, { recursive: true }); }
}
await test('fixture-only complete decision shape requires all checks and independent review', () => fixture(({dir, decision}) => {
  assert.doesNotThrow(() => verifyRootedLifecycleDecision(dir, decision, identity));
  for (const field of ['admitted', 'completeLifecycle']) assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, [field]: false}, identity), /affirmative/);
  assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, synthetic: true}, identity), /affirmative/);
  assert.throws(() => verifyRootedLifecycleDecision(dir, decision, {other: 'host'}), /affirmative/);
}));
await test('every missing lifecycle check fails even with rehashed fixture evidence', () => fixture(({dir, put, evidence, review, decision}) => {
  for (const key of PITCHER_LIFECYCLE_CHECKS) {
    const lifecycle = put('fixture-lifecycle.json', {...evidence, checks: {...evidence.checks, [key]: 'pending'}});
    const independentReview = put('fixture-review.json', {...review, lifecycleSha256: lifecycle.sha256});
    assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, lifecycle, independentReview}, identity), /Incomplete/);
  }
}));
await test('changed evidence, stale review, traversal and symlinks fail closed', () => fixture(({dir, put, evidence, decision}) => {
  writeFileSync(resolve(dir, decision.lifecycle.path), '{}');
  assert.throws(() => verifyRootedLifecycleDecision(dir, decision, identity), /mismatch/);
  const lifecycle = put('fixture-lifecycle.json', {...evidence, extra: 'changed'});
  assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, lifecycle}, identity), /Incomplete/);
  assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, lifecycle: {...lifecycle, path: '../elsewhere'}}, identity), /Unsafe/);
  symlinkSync(resolve(dir, lifecycle.path), resolve(dir, 'link.json'));
  assert.throws(() => verifyRootedLifecycleDecision(dir, {...decision, lifecycle: {...lifecycle, path: 'link.json'}}, identity), /symlink/);
}));
await test('root build GO is never an affirmative admission decision', () => {
  const pin = JSON.parse(readFileSync('docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-BUILD-PIN2.json', 'utf8'));
  assert.equal(pin.modelAdmission, false); assert.equal(pin.publicAdmission, false);
  assert.throws(() => verifyRootedLifecycleDecision(process.cwd(), pin, identity), /affirmative/);
  assert.throws(() => admitRootedPitcher(process.cwd(), undefined), /descriptor/);
});
await test('real retained isolated host cannot opt in without a separately pinned decision', () => {
  const host = 'tmp/rooted-pitcher-app2/dist', pin = 'docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-BUILD-PIN2.json';
  assert.throws(() => admitRootedPitcher(process.cwd(), {
    schema: 'wildshard.shared-arena.rooted-input.v1', id: 'pitcher', host,
    receipt: { path: 'rooted-pitcher-proof.json', sha256: sha(readFileSync(`${host}/rooted-pitcher-proof.json`)) },
    pin: { path: pin, sha256: sha(readFileSync(pin)) },
  }), /Missing exact rooted artifact pin/);
});

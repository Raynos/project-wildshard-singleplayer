// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import { test } from 'node:test';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only filesystem admission harness, never browser code.
import { resolve, dirname } from 'node:path';
import { ROOT, CANDIDATE, FACTORY, FREEZE_SHA256, BUILD_PIN, PREVIEW, DIST,
  admitConchMotion5, buildInputs, validateBuildPin, assertCandidatePose, inventory } from '../scripts/build-conch-motion5-preview.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
function fixture() {
  mkdirSync(resolve(ROOT, 'tmp'), { recursive: true });
  const root = mkdtempSync(resolve(ROOT, 'tmp/conch-motion5-build-test-'));
  const write = (path, bytes) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), bytes); };
  for (const path of ['src/host.ts', 'vite/host.ts', 'lint/policy.json', 'scripts/build.mjs', 'practice.html',
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'public/assets/models/driftwood-fp/fp-arms.glb',
    'public/assets/physics/rapier.wasm']) write(path, 'exact');
  write(`${CANDIDATE}/freeze-manifest.json`, readFileSync(resolve(ROOT, CANDIDATE, 'freeze-manifest.json')));
  write('docs/reviews/audit.md', 'Independent source audit. Candidate is unaccepted.');
  const manifest = { candidate: 'conch-motion5-complete-upper-body-study' };
  const pin = { schema: 'wildshard.conch.motion5.reviewed-build-pin.v1', candidate: manifest.candidate,
    buildAllowed: true, runtimeAcceptance: false, visualAcceptance: false, colliderAcceptance: false,
    rootGo: 'fixture-only root permission', reviewPath: 'docs/reviews/audit.md', nodeVersion: process.version,
    sourceFreezeSha256: FREEZE_SHA256, reviewSha256: hash(readFileSync(resolve(root, 'docs/reviews/audit.md'))), files: buildInputs(root) };
  return { root, write, manifest, pin, close: () => rmSync(root, { recursive: true, force: true }) };
}

await test('real frozen source/native body admits without granting build or runtime acceptance', () => {
  const result = admitConchMotion5();
  assert.equal(result.manifest.buildAllowed, false);
  assert.equal(result.manifest.runtimeAcceptance, false);
  assert.equal(result.receipt.colliderAcceptance, false);
  assert.equal(hash(readFileSync(resolve(ROOT, CANDIDATE, 'freeze-manifest.json'))), FREEZE_SHA256);
  assert.equal(result.manifest.files[FACTORY], hash(readFileSync(resolve(ROOT, FACTORY))));
  assert.equal(BUILD_PIN, 'tmp/conch-motion5-preview/reviewed-build-pin.json');
  assert.equal(PREVIEW, 'tmp/conch-motion5-preview/motion5');
  assert.equal(DIST, 'tmp/conch-motion5-preview-dist');
});

await test('motion5 build pin refuses motion4 permission, acceptance and incomplete source closure', () => {
  const f = fixture();
  try {
    assert.doesNotThrow(() => validateBuildPin(f.root, f.manifest, f.pin));
    for (const mutation of [{ schema: 'wildshard.conch.motion4.reviewed-build-pin.v1' }, { candidate: 'motion4' },
      { rootGo: '' }, { buildAllowed: false }, { runtimeAcceptance: true }, { visualAcceptance: true },
      { colliderAcceptance: true }, { sourceFreezeSha256: 'wrong' }, { reviewSha256: 'wrong' },
      { reviewPath: '/outside' }, { reviewPath: 'docs/reviews/../outside' }, { files: {} }, { nodeVersion: 'wrong' }])
      assert.throws(() => validateBuildPin(f.root, f.manifest, { ...f.pin, ...mutation }));
    f.write('src/host.ts', 'changed');
    assert.throws(() => validateBuildPin(f.root, f.manifest, f.pin), /closure changed/u);
    f.write('src/host.ts', 'exact'); f.write('src/extra.ts', 'new import possibility');
    assert.throws(() => validateBuildPin(f.root, f.manifest, f.pin), /closure changed/u);
    rmSync(resolve(f.root, 'src/extra.ts')); rmSync(resolve(f.root, 'src/host.ts'));
    assert.throws(() => validateBuildPin(f.root, f.manifest, f.pin), /closure changed/u);
  } finally { f.close(); }
});

await test('changed freeze, review or symlink cannot satisfy exact admission', () => {
  const f = fixture();
  try {
    f.write('docs/reviews/audit.md', 'different review');
    assert.throws(() => validateBuildPin(f.root, f.manifest, f.pin), /audit changed/u);
    f.write(`${CANDIDATE}/freeze-manifest.json`, '{}');
    assert.throws(() => validateBuildPin(f.root, f.manifest, f.pin), /freeze changed/u);
    symlinkSync(resolve(f.root, 'practice.html'), resolve(f.root, 'src/symlink.ts'));
    assert.throws(() => inventory(f.root, 'src'), /Symlink/u);
  } finally { f.close(); }
});

await test('product pose requires exact frozen content, unique name, safe path and matching hash', () => {
  const f = fixture();
  try {
    const pose = { programs: [{ id: 'motion5', nodes: [1] }], scalars: [] };
    f.write(`${CANDIDATE}/poses.json`, JSON.stringify(pose));
    const bytes = JSON.stringify({ scalars: [], programs: pose.programs });
    f.write('product/pose.json', bytes);
    const index = { files: [{ name: 'poses/conch-duelist.json', path: 'pose.json', hash: hash(bytes) }] };
    assert.doesNotThrow(() => assertCandidatePose(f.root, index, resolve(f.root, 'product')));
    assert.throws(() => assertCandidatePose(f.root, { files: [] }, resolve(f.root, 'product')));
    assert.throws(() => assertCandidatePose(f.root, { files: [...index.files, ...index.files] }, resolve(f.root, 'product')));
    assert.throws(() => assertCandidatePose(f.root, { files: [{ ...index.files[0], path: '../practice.html' }] }, resolve(f.root, 'product')));
    assert.throws(() => assertCandidatePose(f.root, { files: [{ ...index.files[0], hash: 'wrong' }] }, resolve(f.root, 'product')));
    f.write('product/pose.json', JSON.stringify({ programs: [{ id: 'motion4' }], scalars: [] }));
    const replacement = readFileSync(resolve(f.root, 'product/pose.json'));
    assert.throws(() => assertCandidatePose(f.root, { files: [{ ...index.files[0], hash: hash(replacement) }] }, resolve(f.root, 'product')), /not the frozen/u);
  } finally { f.close(); }
});

await test('adapter keeps real practice entry, pinned factory and SDK product path without runtime edits', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/build-conch-motion5-preview.mjs'), 'utf8');
  assert.match(source, /entry: resolve\(ROOT, FACTORY\)/u);
  assert.match(source, /author\.buildConchMotion5PreviewProduct\(project, productDirectory, \{ decisionLegacyLines: lines \}, metadata\)/u);
  assert.match(source, /input: resolve\('practice.html'\)/u);
  assert.match(source, /__SAVE_NAMESPACES__: '\[\]'/u);
  assert.doesNotMatch(source, /admitConchReviewedBuild|CONCH_READABLE_PREVIEW_DIR|buildConchReadablePreviewProduct/u);
  assert.match(source, /assertHeavyLease\('build'\)/u);
});

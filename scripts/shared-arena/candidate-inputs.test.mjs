import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { FOUR, ACCEPTANCE, CONCH_DELTAS, digest, inventory, retainedCandidateProducts, sourceSnapshot, assertPermission, safeFile, candidateBuildPolicy, reserveOutput, pinnedBytes, writePinnedOutput, verifyPinnedOutputs } from './candidate-inputs.mjs';

const base = resolve('tmp/candidate-unit-fixtures');
mkdirSync(base, { recursive: true });
function fixture(run) {
  const root = mkdtempSync(`${base}/case-`);
  const put = (name, value) => { const path = resolve(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); return path; };
  try { return run(root, put); } finally { rmSync(root, { recursive: true, force: true }); }
}
function products(root, put) {
  const pins = { enemies: {} };
  for (const id of FOUR) {
    const prefix = `hosts/${id}-engine/`, product = `${prefix}practice-product/`;
    put(`${prefix}body.bin`, 'fixture only');
    put(`${product}bodies.json`, { bodies: [{ kind: id }], file: '/body.bin' });
    put(`${product}looks.json`, { looks: [{ id, kind: id, species: id }] });
    const sourceHash = digest(id);
    put(`${product}shard.json`, { build: { sourceHash }, files: [{ name: 'practice/bodies.json', path: 'bodies.json' }, { name: 'practice/looks.json', path: 'looks.json' }] });
    put(`${product}validation.json`, { indexHash: digest(readFileSync(resolve(root, `${product}shard.json`))) });
    put(`${prefix}${id}-preview.json`, { candidate: id, mode: 'fixture', bodyFile: '/body.bin' });
    pins.enemies[id] = { candidate: id, mode: 'fixture', kind: id, sourceHash, files: inventory(resolve(root, prefix)) };
  }
  put('practice/shared-arena/pins.json', pins);
  return pins;
}
await test('retained-byte fixture verification is four-only and not source admission', () => fixture((root, put) => {
  products(root, put);
  assert.deepEqual(retainedCandidateProducts(root, resolve(root, 'hosts')).map(row => row.id), FOUR);
  put('hosts/conch-engine/practice-product/extra.json', '{}');
  assert.throws(() => retainedCandidateProducts(root, resolve(root, 'hosts')), /Unpinned product inventory/);
}));
await test('changed body and receipt bytes fail closed', () => {
  for (const name of ['body.bin', 'practice-product/validation.json']) fixture((root, put) => {
    products(root, put); put(`hosts/conch-engine/${name}`, 'changed');
    assert.throws(() => retainedCandidateProducts(root, resolve(root, 'hosts')), /Retained pin mismatch/);
  });
});
await test('symlink ancestors and traversal cannot supply retained input bytes', () => fixture((root, put) => {
  put('real/file', 'x'); symlinkSync(resolve(root, 'real'), resolve(root, 'link'));
  assert.throws(() => safeFile(root, 'link/file'), /non-symlink/);
  assert.throws(() => safeFile(root, '../file'), /Unsafe/);
}));
await test('exact-source permission binds review, output, products and false acceptance independently', () => fixture((root, put) => {
  put('docs/reviews/fixture.md', 'Source-only review fixture; not real permission');
  mkdirSync(resolve(root, 'hosts')); mkdirSync(resolve(root, 'tmp/shared-arena-candidates'), { recursive: true });
  const snapshot = { fixture: true }, destination = resolve(root, 'tmp/shared-arena-candidates/new');
  const permission = { schema: 'wildshard.shared-arena.candidate-permission.v1', buildAllowed: true, localOnly: true, admitted: false, reviewedBy: 'root', rootGo: 'UNIT FIXTURE ONLY', reviewPath: 'docs/reviews/fixture.md', reviewSha256: digest('Source-only review fixture; not real permission'), sourceSnapshotSha256: digest(JSON.stringify(snapshot)), hostRoot: resolve(root, 'hosts'), destination, acceptance: ACCEPTANCE, products: FOUR };
  const check = p => assertPermission(p, snapshot, permission.hostRoot, destination, root);
  check(permission);
  for (const change of [{ rootGo: '' }, { buildAllowed: false }, { admitted: true }, { products: [...FOUR, 'pitcher'] }, { acceptance: { ...ACCEPTANCE, runtimeAcceptance: true } }, { sourceSnapshotSha256: 'bad' }, { reviewSha256: 'bad' }, { destination: resolve(root, 'production') }]) assert.throws(() => check({ ...permission, ...change }));
  mkdirSync(destination); assert.throws(() => check(permission), /NEW local/);
}));
await test('source proposal inventory binds all nine deltas and dependency bytes', () => fixture((root, put) => {
  for (const dir of ['src', 'practice', 'scripts', 'vite', 'node_modules']) mkdirSync(resolve(root, dir));
  put('package.json', {}); put('pnpm-lock.yaml', 'fixture lock'); put('node_modules/dependency.js', 'original dependency');
  const files = Object.fromEntries(CONCH_DELTAS.map(path => { put(path, `current ${path}`); return [path, digest(`old ${path}`)]; }));
  const conchBase = 'art/driftwood-isle/approved-conch/runtime-admission/arena-motion4/';
  put(`${conchBase}freeze-manifest.json`, { files }); put(`${conchBase}reviewed-build-pin.json`, { files: {} });
  const first = sourceSnapshot(root);
  assert.deepEqual(first.conchDeltas.map(row => row.path), CONCH_DELTAS);
  put('node_modules/dependency.js', 'changed dependency');
  assert.notEqual(digest(JSON.stringify(sourceSnapshot(root))), digest(JSON.stringify(first)));
  put(CONCH_DELTAS[0], `old ${CONCH_DELTAS[0]}`);
  assert.throws(() => sourceSnapshot(root), /exactly nine/);
}));
await test('candidate builder uses current validator and does not call or modify original admission', () => {
  const code = readFileSync(new URL('candidate-build.mjs', import.meta.url), 'utf8');
  assert.match(code, /validateArenaProducts/); assert.match(code, /Current validation changed the exact source/);
  assert.match(code, /NOT ADMITTED/); assert.match(code, /assertHeavyLease\('build'\)/);
  assert.doesNotMatch(code, /admitSharedArena|rootedInput|capExempt|git show|renderBuiltUrl/);
  const validator = readFileSync(new URL('../../practice/shared-arena/validate.ts', import.meta.url), 'utf8');
  assert.match(validator, /validateOutputProduct\(path\)/);
});

await test('candidate policy never exposes ambient env or discovers PostCSS configuration', () => fixture((root, put) => {
  put('.env', 'VITE_SENTRY_DSN=https://not-allowed.invalid\nVITE_SECRET=private-fixture');
  put('postcss.config.cjs', 'throw new Error("ambient PostCSS must not execute")');
  const before = process.env.VITE_SENTRY_DSN;
  try {
    process.env.VITE_SENTRY_DSN = 'https://not-allowed.invalid';
    const policy = candidateBuildPolicy();
    assert.equal(policy.envDir, false);
    assert.deepEqual(policy.envPrefix, []);
    assert.deepEqual(policy.css.postcss, { plugins: [] });
    assert.equal(policy.configFile, false);
    assert.equal(policy.mode, 'candidate');
    assert.equal(policy.define['import.meta.env.VITE_SENTRY_DSN'], '""');
    assert.equal(policy.define['import.meta.env.PROD'], 'true');
    assert.equal(policy.define['import.meta.env.DEV'], 'false');
    assert.doesNotMatch(JSON.stringify(policy), /not-allowed|private-fixture/);
    const code = readFileSync(new URL('candidate-build.mjs', import.meta.url), 'utf8');
    assert.equal((code.match(/build\(\{ \.\.\.policy/g) ?? []).length, 2);
    assert.match(code, /connect-src 'self'/);
    assert.match(code, /build:\{write:false,outDir/);
    assert.doesNotMatch(code, /copyFileSync|writeBundle/);
    assert.match(code, /process.env.NODE_ENV = 'production'/);
  } finally {
    if (before === undefined) delete process.env.VITE_SENTRY_DSN;
    else process.env.VITE_SENTRY_DSN = before;
  }
}));
await test('exclusive reservation refuses existing, concurrent and dangling symlink destinations', () => fixture((root) => {
  const destination = resolve(root, 'out');
  const reservation = reserveOutput(destination);
  reservation.assert(true);
  assert.throws(() => reserveOutput(destination), /EEXIST/);
  writeFileSync(resolve(destination, 'foreign'), 'preserve');
  assert.throws(() => reservation.assert(true), /not empty/);
  assert.equal(readFileSync(resolve(destination, 'foreign'), 'utf8'), 'preserve');
  symlinkSync(resolve(root, 'absent'), resolve(root, 'dangling'));
  assert.throws(() => reserveOutput(resolve(root, 'dangling')), /EEXIST/);
}));
await test('reserved directory replacement and symlink ancestors fail closed', () => fixture((root) => {
  const destination = resolve(root, 'out'), reservation = reserveOutput(destination);
  renameSync(destination, resolve(root, 'old')); mkdirSync(destination);
  assert.throws(() => reservation.assert(), /replaced/);
  const second = reserveOutput(resolve(root, 'second'));
  renameSync(second.path, resolve(root, 'saved'));
  symlinkSync(resolve(root, 'saved'), second.path);
  assert.throws(() => second.assert(), /replaced or symlinked/);
  symlinkSync(resolve(root, 'old'), resolve(root, 'alias'));
  assert.throws(() => reserveOutput(resolve(root, 'alias/new')), /Symlink/);
}));
await test('copies bind immutable pinned bytes, refuse overwrite and detect changed output', () => fixture((root, put) => {
  const expected = digest('pinned'), source = put('source/body.bin', 'pinned');
  const data = pinnedBytes(resolve(root, 'source'), 'body.bin', expected);
  writeFileSync(source, 'changed after read');
  assert.throws(() => pinnedBytes(resolve(root, 'source'), 'body.bin', expected), /pin mismatch/);
  const reservation = reserveOutput(resolve(root, 'out'));
  writePinnedOutput(reservation, 'assets/body.bin', data, expected);
  const pins = { 'assets/body.bin': expected };
  verifyPinnedOutputs(reservation, pins);
  assert.throws(() => writePinnedOutput(reservation, 'assets/body.bin', data, expected), /EEXIST/);
  assert.throws(() => writePinnedOutput(reservation, 'bad.bin', Buffer.from('wrong'), expected), /pin mismatch/);
  writeFileSync(resolve(reservation.path, 'assets/body.bin'), 'changed output');
  assert.throws(() => verifyPinnedOutputs(reservation, pins), /pin mismatch/);
  symlinkSync(resolve(root, 'source'), resolve(reservation.path, 'alias'));
  assert.throws(() => writePinnedOutput(reservation, 'alias/new', data, expected), /EEXIST|Symlink/);
  assert.throws(() => writePinnedOutput(reservation, '../escape', data, expected), /Unsafe/);
}));

await test('replaced output subdirectories and foreign parent trees cannot receive copies', () => fixture((root, put) => {
  const reservation = reserveOutput(resolve(root, 'out')), data = Buffer.from('pinned'), hash = digest(data);
  writePinnedOutput(reservation, 'assets/one', data, hash);
  renameSync(resolve(reservation.path, 'assets'), resolve(reservation.path, 'saved-assets'));
  mkdirSync(resolve(reservation.path, 'assets'));
  assert.throws(() => writePinnedOutput(reservation, 'assets/two', data, hash), /replaced/);
  const other = reserveOutput(resolve(root, 'other'));
  put('outside/preserve', 'unchanged');
  symlinkSync(resolve(root, 'outside'), resolve(other.path, 'foreign'));
  assert.throws(() => writePinnedOutput(other, 'foreign/nested/file', data, hash), /EEXIST/);
  assert.deepEqual(inventory(resolve(root, 'outside')), { preserve: digest('unchanged') });
}));

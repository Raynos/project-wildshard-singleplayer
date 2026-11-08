import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { publishProductFiles } from '../scripts/publish-product-files.mjs';
const root = resolve(import.meta.dirname, '..');
function fixture(run) {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const cwd = mkdtempSync(join(root, 'tmp/shell-release-'));
  try { run(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}
test('the inventory CLI refuses unrecorded, changed or executable legacy source', () => fixture(cwd => {
  const bin = join(cwd, 'bin'); mkdirSync(bin);
  const legacy = 'test/legacy.ts', blob = 'a'.repeat(40);
  const files = {
    'engine.pin.json': JSON.stringify(JSON.parse(readFileSync(join(root, 'engine.pin.json'), 'utf8'))),
    'release-deletions.json': '{"schema":1,"state":"complete","files":[]}',
    'release-archives.json': '{"schema":1,"files":[]}',
    'package.json': '{"scripts":{}}',
    '.github/workflows/deploy.yml': 'node scripts/install-release.mjs install\nnode scripts/build-release.mjs\nneeds: [build-pinned, prove-pinned]',
    '.github/workflows/storage.yml': '', 'scripts/repo-size.mjs': '', 'scripts/storage-policy.json': '{}',
    [legacy]: "import { old } from '" + "../src/game/old" + "';",
  };
  writeFileSync(join(bin, 'git'), `#!/usr/bin/env node
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('fixture.json')), args=process.argv.slice(2);
if(args[0]==='ls-tree') process.stdout.write(Object.keys(fixture.files).map(file=>'100644 blob '+(file==='test/legacy.ts'?fixture.blob:'a'.repeat(40))+'\\t'+file+'\\0').join(''));
else if(args[0]==='show' && args[1].startsWith('HEAD:')) process.stdout.write(fixture.files[args[1].slice(5)]);
else process.exit(1);
`);
  chmodSync(join(bin, 'git'), 0o755);
  const invoke = (heldBlob = blob) => {
    writeFileSync(join(cwd, 'fixture.json'), JSON.stringify({ files, blob: heldBlob }));
    return spawnSync(process.execPath, [join(root, 'scripts/check-shell.mjs'), 'HEAD'], { cwd, encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH } });
  };
  const absent = invoke(); assert.notEqual(absent.status, 0); assert.match(absent.stderr, /Unrecorded legacy source import/u);
  files['release-archives.json'] = JSON.stringify({ schema: 1, files: [{ path: legacy, blob, reason: 'Inactive pre-split fixture' }] });
  const admitted = invoke(); assert.equal(admitted.status, 0, admitted.stderr);
  const changed = invoke('b'.repeat(40)); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Changed inactive source/u);
  files['package.json'] = JSON.stringify({ scripts: { test: `node ${legacy}` } });
  const active = invoke(); assert.notEqual(active.status, 0); assert.match(active.stderr, /Inactive source on release path/u);
}));
test('Vercel packaging runs the output check only and restores config even on native failure', () => fixture(cwd => {
  const bin = join(cwd, 'bin'); mkdirSync(bin);
  const config = '{\n  "buildCommand": "original", "headers": []\n}\n';
  writeFileSync(join(cwd, 'vercel.json'), config);
  writeFileSync(join(bin, 'vercel'), `#!/usr/bin/env node
import fs from 'node:fs';
fs.writeFileSync('observed.json', JSON.stringify({args:process.argv.slice(2),config:JSON.parse(fs.readFileSync('vercel.json'))}));
process.exit(Number(process.env.NATIVE_EXIT));
`);
  chmodSync(join(bin, 'vercel'), 0o755);
  for (const code of [0, 23]) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/build-vercel-output.mjs')], {
      cwd, encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, VERCEL_BUILD_TOKEN: 'fixture-only', NATIVE_EXIT: String(code) },
    });
    assert.equal(result.status, code, result.stderr);
    assert.equal(readFileSync(join(cwd, 'vercel.json'), 'utf8'), config);
    const observed = JSON.parse(readFileSync(join(cwd, 'observed.json'), 'utf8'));
    assert.deepEqual(observed.args, ['build', '--standalone', '--prod', '--scope', 'raynos-projects', '--token', 'fixture-only']);
    assert.equal(observed.config.buildCommand, 'node scripts/check-release-output.mjs');
    assert.equal(observed.config.installCommand, 'true');
    assert.equal(observed.config.outputDirectory, 'dist');
  }
}));
test('the retired rollback refuses before Git, network or pin mutation', () => fixture(cwd => {
  mkdirSync(join(cwd, '.github'));
  const file = join(cwd, '.github/deploy-pin.json'), original = '{"mode":"pinned","sha":"held"}\n';
  writeFileSync(file, original);
  const result = spawnSync(process.execPath, [join(root, 'scripts/deploy-pin.mjs'), 'rollback', 'old', '--go', 'fixture'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /retired by J179.*Fix forward.*manual vercel rollback/u);
  assert.equal(readFileSync(file, 'utf8'), original);
}));
for (const name of ['shell-prebuilt.py', 'shell-stage.py']) test(`${name}: real shell release controller boundaries`, () => {
  const result = spawnSync('python3', [join(root, 'test', name)], { cwd: root, encoding: 'utf8', timeout: 4000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('published product URLs survive packed-copy pruning with exact bytes', async () => {
  const cwd = mkdtempSync(join(root, 'tmp/product-publication-'));
  const engine = join(cwd, 'engine'), output = join(cwd, 'dist'), slug = 'open-plot-fixture';
  const body = Buffer.from('immutable admitted GLB bytes'), hash = createHash('sha256').update(body).digest('hex');
  const file = `blobs/glb/${hash}.glb`, path = `/shardfiles/${slug}/${file}`;
  mkdirSync(join(engine, 'out', slug, 'blobs/glb'), { recursive: true });
  mkdirSync(join(output, 'shardfiles', slug), { recursive: true });
  writeFileSync(join(engine, 'out', slug, file), body);
  writeFileSync(join(output, 'shardfiles', slug, 'shard.json'), JSON.stringify({ identity: { slug }, files: [{ path: file, hash, compressed: body.length }] }));
  const server = createServer((request, response) => {
    try { response.end(readFileSync(join(output, new URL(request.url, 'http://fixture').pathname))); }
    catch { response.writeHead(404); response.end(); }
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(origin + path)).status, 404);
    assert.equal((await fetch(origin + `/assets/${slug}/entry-reads.json`)).status, 404);
    assert.deepEqual(publishProductFiles(engine, output), { restored: 1, bytes: body.length, emptyRecords: 1 });
    const result = await fetch(origin + path);
    assert.equal(result.status, 200);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), body);
    assert.deepEqual(await (await fetch(origin + `/assets/${slug}/entry-reads.json`)).json(), []);
    const recorded = '[{"region":"authored","tier":"phone","at":[0,0],"reads":[]}]\n';
    writeFileSync(join(output, 'assets', slug, 'entry-reads.json'), recorded);
    assert.deepEqual(publishProductFiles(engine, output), { restored: 0, bytes: 0, emptyRecords: 0 });
    assert.equal(readFileSync(join(output, 'assets', slug, 'entry-reads.json'), 'utf8'), recorded);
    writeFileSync(join(output, 'shardfiles', slug, file), 'corrupt');
    assert.throws(() => publishProductFiles(engine, output), /hash or size differs/u);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(cwd, { recursive: true, force: true });
  }
});

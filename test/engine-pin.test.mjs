// CLI boundary: failed remote evidence never mutates a release pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..'), script = join(root, 'scripts/engine-pin.mjs');
const repos = ['shard-driftwood','shard-sky-reach','shard-dunes','shard-nalati','shard-pine-hollow','shard-nine-dragon','shard-open-plots'];
function fixture(run) {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const cwd = mkdtempSync(join(root, 'tmp/pin-boundary-')), bin = join(cwd, 'bin'); mkdirSync(bin);
  const pin = { schema: 1, engine: { repo: 'engine', tag: 'v0.1.1', commit: 'd'.repeat(40) }, saveEpoch: 1, shards: repos.map(repo => ({ repo, commit: 'c'.repeat(40) })) };
  const original = JSON.stringify(pin, null, 2) + '\n'; writeFileSync(join(cwd, 'engine.pin.json'), original);
  writeFileSync(join(bin, 'git'), `#!/usr/bin/env node
if (process.argv[2] === 'rev-parse') { console.log('a'.repeat(40)); process.exit(0); }
if (process.argv[2] !== 'ls-remote') throw new Error('Unexpected Git mutation');
if (!process.env.PIN_MISSING_TAG) { const tag=process.argv[4]; console.log('e'.repeat(40)+'\\t'+tag); console.log('a'.repeat(40)+'\\t'+tag+'^{}'); }
`);
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node
const url=process.argv[3];
if (process.env.PIN_PUBLIC_ONLY && !url.startsWith('repos/project-wildshard/engine/')) throw new Error('Private repo requested by public build');
if(url.includes('/contents/save-epoch.json')) console.log(JSON.stringify({saveEpoch:Number(process.env.PIN_EPOCH??1)}));
else { const repo=url.split('/')[2], sha=new URL('https://api.github.com/'+url).searchParams.get('head_sha'); console.log(JSON.stringify({workflow_runs:['ci','ring-1'].map((name,id)=>({name,id,event:'push',head_sha:sha,status:'completed',conclusion:process.env.PIN_RED_REPO===repo?'failure':'success'}))})); }
`);
  chmodSync(join(bin, 'git'), 0o755); chmodSync(join(bin, 'gh'), 0o755);
  const invoke = env => spawnSync(process.execPath, [script, 'bump', 'v0.1.2', 'shard-driftwood=' + 'b'.repeat(40)], { cwd, encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, ...env } });
  try { run({ cwd, original, invoke }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}
test('pin bump resolves an annotated tag and updates one of seven immutable provenance pins', () => fixture(({ cwd, invoke }) => {
  const result = invoke({}); assert.equal(result.status, 0, result.stderr);
  const pin = JSON.parse(readFileSync(join(cwd, 'engine.pin.json'), 'utf8'));
  assert.equal(pin.engine.commit, 'a'.repeat(40)); assert.equal(pin.engine.tag, 'v0.1.2');
  assert.equal(pin.saveEpoch, 1); assert.equal(pin.shards.length, 7); assert.equal(pin.shards[0].commit, 'b'.repeat(40)); assert.equal(pin.shards[1].commit, 'c'.repeat(40));
}));
test('missing tag, red engine, red shard, and epoch downgrade all refuse without changing the pin', () => {
  for (const env of [{ PIN_MISSING_TAG: '1' }, { PIN_RED_REPO: 'engine' }, { PIN_RED_REPO: 'shard-pine-hollow' }, { PIN_EPOCH: '0' }]) fixture(({ cwd, original, invoke }) => {
    const result = invoke(env); assert.notEqual(result.status, 0, result.stdout);
    assert.equal(readFileSync(join(cwd, 'engine.pin.json'), 'utf8'), original);
  });
});

test('public release verification and installation never query private shard repositories', () => fixture(({ cwd, invoke }) => {
  assert.equal(invoke({}).status, 0);
  mkdirSync(join(cwd, 'engine-source'));
  // Exercise the real installer with only the default public-repo capability.
  const result = spawnSync(process.execPath, [join(root, 'scripts/install-release.mjs'), 'verify'], {
    cwd, encoding: 'utf8', env: { ...process.env, PATH: join(cwd, 'bin') + ':' + process.env.PATH, PIN_PUBLIC_ONLY: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /private shard sources are not build inputs/u);
}));

test('a malformed current epoch refuses before a bump can weaken its floor', () => fixture(({ cwd, invoke }) => {
  const file = join(cwd, 'engine.pin.json'), pin = JSON.parse(readFileSync(file, 'utf8'));
  delete pin.saveEpoch; const held = JSON.stringify(pin); writeFileSync(file, held);
  const result = invoke({ PIN_EPOCH: '0' }); assert.notEqual(result.status, 0);
  assert.equal(readFileSync(file, 'utf8'), held);
}));

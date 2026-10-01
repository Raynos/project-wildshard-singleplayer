// oxlint-disable-next-line import/no-nodejs-modules -- Matrix integration fixtures inspect real temporary Git commits.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Matrix integration fixtures own temporary repositories.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary repositories belong outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Matrix fixtures need host filesystem paths.
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { matrix } from '../scripts/gpu-gate/matrix.mjs';
import { gateResult, shardResult } from '../scripts/gpu-gate/status.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function repo(files: Record<string, string>): { cwd: string; sha: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'wildshard-matrix-'));
  roots.push(cwd);
  const git = (args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(['init', '-q']);
  for (const [name, source] of Object.entries(files)) { mkdirSync(dirname(join(cwd, name)), { recursive: true }); writeFileSync(join(cwd, name), source); }
  git(['add', ...Object.keys(files)]);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture']);
  return { cwd, sha: git(['rev-parse', 'HEAD']) };
}
const manifests = { 'src/shards/a/manifest.ts': '', 'src/shards/b/manifest.ts': '', 'src/shards/_template/manifest.ts': '' };
describe('target SHA GPU jobs', () => {
  it('bootstraps unsplit new shards, splits only comparisons and reads the commit rather than WIP', () => {
    const { cwd, sha } = repo({ ...manifests, 'test/parity/baselines/gh-macos15/a.phone.json': '{}' });
    writeFileSync(join(cwd, 'test/parity/baselines/gh-macos15/b.phone.json'), '{}');
    expect(matrix(sha, 'compare', { cwd, split: new Set(['a', 'b']) })).toEqual([
      { shard: '_template', mode: 'bootstrap', part: '' },
      { shard: 'a', mode: 'compare', part: 'fingerprint+poses' },
      { shard: 'a', mode: 'compare', part: 'walk+combat+leak' },
      { shard: 'b', mode: 'bootstrap', part: '' },
    ]);
    expect(matrix(sha, 'record', { cwd, split: new Set(['a']) })).toEqual(['_template', 'a', 'b'].map((shard) => ({ shard, mode: 'record', part: '' })));
  });
  it('proves one part per plant and shard, excluding nightly/Linux plants', () => {
    const { cwd, sha } = repo({ ...manifests, 'test/parity/plants/index.json': JSON.stringify([
      { id: 'common', kind: 'patch', shards: 'all' }, { id: 'metal-off', kind: 'flag', shards: ['a'] },
      { id: 'asset-case', kind: 'linux', shards: 'all' }, { id: 'soak-leak', kind: 'nightly', shards: 'all' },
    ]) });
    expect(matrix(sha, 'prove', { cwd })).toEqual([
      { shard: '_template', mode: 'prove', part: 'green' }, { shard: '_template', mode: 'prove', part: 'common' },
      { shard: 'a', mode: 'prove', part: 'green' }, { shard: 'a', mode: 'prove', part: 'common' }, { shard: 'a', mode: 'prove', part: 'metal-off' },
      { shard: 'b', mode: 'prove', part: 'green' }, { shard: 'b', mode: 'prove', part: 'common' },
    ]);
  });
  it('refuses an export with no shard manifests', () => {
    const { cwd, sha } = repo({ 'README.md': 'no shards' });
    expect(() => matrix(sha, 'record', { cwd })).toThrow('no shards');
  });
  it('rejects moving references and unknown modes', () => {
    expect(() => matrix('HEAD', 'compare')).toThrow('40-hex');
    expect(() => matrix('a'.repeat(40), 'typo')).toThrow('mode');
  });
});

describe('GPU gate status mapping', () => {
  it('keeps infrastructure red and bootstrap status explicit', () => {
    expect(shardResult('failure', [{ exitCode: 3 }], '', 'compare', 'a').state).toBe('error');
    expect(shardResult('success', [], '', 'bootstrap', 'a').description).toBe('bootstrap record: commit parity-baselines-gh-macos15-a');
    expect(shardResult('failure', [{ fields: [{ verdict: 'red', field: 'walk.stuck' }] }], '', 'compare', 'a').description).toBe('walk.stuck');
    expect(shardResult('success', [{ flaked: ['poses.gate.ssim'], pending: ['E357-look'] }], '', 'compare', 'a').description).toBe('green (retried: poses.gate.ssim) · pending board: E357-look');
  });
  it('requires every job and assets green; timeout produces infrastructure error', () => {
    const statuses = [{ context: 'gpu-gate/a', state: 'success', description: 'green' }, { context: 'gpu-gate/asset-case', state: 'success', description: '5 URLs checked' }];
    expect(gateResult('success,success', [], statuses)).toEqual({ state: 'success', description: '1/1 shards green · assets ok' });
    expect(gateResult('failure,success', [], statuses).state).toBe('failure');
    expect(gateResult('failure,success', [{ name: 'shard (a)', conclusion: 'timed_out' }], statuses).state).toBe('error');
    expect(gateResult('failure,success', [{ name: 'shard (a)', conclusion: 'failure', infrastructure: true }], statuses).state).toBe('error');
  });
});

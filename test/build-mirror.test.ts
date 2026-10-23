// oxlint-disable-next-line import/no-nodejs-modules -- Commit into an owned throwaway Git repository.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Every write is confined to an owned fixture under ./tmp.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The mirror root comes from the fixture's environment.
import { env as processEnv, pid } from 'node:process';
import { afterEach, expect, it, vi } from 'vitest';
import { openMirror } from '../scripts/build-mirror.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';

const owned: string[] = [];
afterEach(() => { for (const dir of owned.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it('caps live slot and FIFO waits at five minutes, names holders and removes its ticket', () => {
  const { repo, env } = fixture();
  const root = env['WILDSHARD_BUILD_MIRROR'] ?? '';
  const lock = join(root, 'check.lock');
  const queue = join(root, 'checks.queue');
  for (const slot of ['check', 'check2', 'check3', 'check4', 'check5']) {
    const held = join(root, `${slot}.lock`);
    mkdirSync(held, { recursive: true });
    writeFileSync(join(held, 'owner'), String(pid));
    writeFileSync(join(held, 'owner.json'), JSON.stringify({ pid, command: 'node owned-build.mjs', startedAt: '2026-10-22T15:00:00Z' }));
  }
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(lock, 'owner'), String(pid));
  const details = JSON.stringify({ pid, command: 'node owned-build.mjs', startedAt: '2026-10-22T15:00:00Z' });
  writeFileSync(join(lock, 'owner.json'), details);
  for (const queued of [false, true]) {
    const first = `000000000000001-${pid}`;
    if (queued) writeFileSync(join(queue, first), details);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now).mockReturnValue(now + 300_000);
    try {
      expect(() => openMirror('HEAD', { repo, env })).toThrow(
        new RegExp(`after 5 min.*slot=check pid=${pid} lane=unknown age=[0-9.]+s command="node owned-build.mjs" start=2026-10-22T15:00:00Z.*slot=check2.*slot=check3.*slot=check4.*slot=check5${queued ? '.*queue head' : ''}`, 'u'),
      );
      expect(readdirSync(queue)).toEqual(queued ? [first] : []);
      expect(readFileSync(join(lock, 'owner'), 'utf8')).toBe(String(pid));
    } finally { clock.mockRestore(); }
  }
});

function fixture(): { repo: string; commit: (files: Record<string, string | null>) => string; env: NodeJS.ProcessEnv } {
  const scratch = resolve('tmp');
  mkdirSync(scratch, { recursive: true });
  const base = mkdtempSync(join(scratch, 'build-mirror-test-'));
  owned.push(base);
  const repo = join(base, 'repo');
  mkdirSync(join(repo, 'node_modules', '@wildshard'), { recursive: true });
  writeFileSync(join(repo, '.gitignore'), 'node_modules\ndist/\n');
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const commit = (files: Record<string, string | null>): string => {
    for (const [path, body] of Object.entries(files)) {
      if (body === null) { rmSync(join(repo, path)); continue; }
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), body);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  // The toy repository owns no outer CI/full-test capacity.
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) => !key.startsWith('WS_HEAVY_')));
  return { repo, commit, env: { ...env, WILDSHARD_BUILD_MIRROR: join(base, 'mirror') } };
}

it('syncs only what differs, drops art/progress/sources, and leaves the checkout untouched', () => {
  const { repo, commit, env } = fixture();
  const first = commit({ 'src/a.ts': 'a1', 'src/b.ts': 'b1', 'src/keep.ts': 'k', 'index.html': 'i1', 'art/big.png': 'x', 'progress/p.png': 'x', 'sources/s.blend': 'x' });
  const second = commit({ 'src/a.ts': 'a2', 'src/b.ts': null });

  const one = openMirror(first, { repo, env });
  const inventory: unknown=JSON.parse(readFileSync(processEnv['WS_GENERATION_TREE_FILES'] ?? '', 'utf8'));
  expect(inventory).toMatchObject({root:one.dir});
  expect(inventory).toHaveProperty('files',expect.arrayContaining(['src/a.ts','src/keep.ts']));
  expect(processEnv['WS_GENERATION_TREE_ROOT']).toBe(one.dir);
  one.release();
  expect(readFileSync(join(one.dir, 'src/b.ts'), 'utf8')).toBe('b1');
  expect(['art', 'progress', 'sources'].filter((d) => existsSync(join(one.dir, d)))).toEqual([]);
  const untouched = lstatSync(join(one.dir, 'src/keep.ts')).ino;
  writeFileSync(join(one.dir, 'index.html'), 'tampered');
  writeFileSync(join(one.dir, 'src/stray.ts'), 'left behind');
  mkdirSync(join(one.dir, 'dist'));
  writeFileSync(join(one.dir, 'dist/out.js'), 'kept');

  const two = openMirror(second, { repo, env });
  two.release();
  expect(two.dir).toBe(one.dir);
  expect(readFileSync(join(two.dir, 'src/a.ts'), 'utf8')).toBe('a2');
  expect(existsSync(join(two.dir, 'src/b.ts'))).toBe(false);
  expect(existsSync(join(two.dir, 'src/stray.ts'))).toBe(false);
  expect(readFileSync(join(two.dir, 'index.html'), 'utf8')).toBe('i1');
  expect(readFileSync(join(two.dir, 'dist/out.js'), 'utf8')).toBe('kept');
  expect(lstatSync(join(two.dir, 'src/keep.ts')).ino).toBe(untouched);
  expect(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' })).toBe('');
  expect(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: two.dir, encoding: 'utf8' }).status).not.toBe(0);

  const full = openMirror(second, { repo, env, slot: 'check2', full: true });
  full.release();
  expect(readFileSync(join(full.dir, 'art/big.png'), 'utf8')).toBe('x');
});

it('links workspace packages to the mirror sources, takes over a dead lock and queue ticket, rejects bad slots', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'src/engine/package.json': '{"name":"@wildshard/engine"}', 'src/engine/index.ts': 'e' });
  const lock = join(env['WILDSHARD_BUILD_MIRROR'] ?? '', 'check.lock');
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, 'owner'), '999999\n');
  const queue = join(env['WILDSHARD_BUILD_MIRROR'] ?? '', 'checks.queue');
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(queue, '000000000000001-999999'), '');
  const mirror = openMirror(sha, { repo, env });
  expect(readdirSync(queue)).toEqual([]);
  expect(resolve(join(mirror.dir, 'node_modules', '@wildshard'), readlinkSync(join(mirror.dir, 'node_modules', '@wildshard', 'engine')))).toBe(join(mirror.dir, 'src', 'engine'));
  mirror.release();
  expect(existsSync(lock)).toBe(false);
  expect(() => openMirror(sha, { repo, env, slot: '../escape' })).toThrow(/invalid slot/u);
  expect(() => openMirror(sha, { repo, env, slot: 'check6' })).toThrow(/invalid slot/u);
  expect(() => openMirror(sha, { repo, env, slot: 'lane-x6' })).toThrow(/invalid slot/u);
  expect(() => openMirror(sha, { repo, env, slot: 'gate' })).toThrow(/invalid slot/u);
  expect(() => openMirror(sha, { repo, env, slot: 'commit' })).toThrow(/invalid slot/u);
  for (const slot of ['ruler', 'check', 'check2', 'check3', 'check4', 'check5']) {
    const admitted = openMirror(sha, { repo, env, slot }); admitted.release();
  }
});

it('spreads check names across five slots and keeps ruler independent', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'source.txt': 'fixture' });
  const held = ['check5', 'check4', 'check', 'check2', 'check3'].map(slot => openMirror(sha, { repo, env, slot }));
  const ruler = openMirror(sha, { repo, env, slot: 'ruler' });
  try {
    expect(held.map(mirror => dirname(mirror.dir).split('/').at(-1))).toEqual(['check', 'check2', 'check3', 'check4', 'check5']);
    expect(dirname(ruler.dir).split('/').at(-1)).toBe('ruler');
    held[2]?.release();
    const next = openMirror(sha, { repo, env, slot: 'check5' });
    expect(next.dir).toBe(held[2]?.dir);
    next.release();
  } finally { for (const mirror of held) mirror.release(); ruler.release(); }
});

it('keeps whole generated jobs, invalidates partial jobs and prunes retired outputs', () => {
  const { repo, commit, env } = fixture();
  const catalog = (outputs: string[]): string => JSON.stringify({ jobs: [{ buildTimeOutputs: outputs }] });
  const paths = ['dist/rows.json', 'assets/creature', 'assets/retained'];
  const first = commit({ 'scripts/generation-jobs.json': catalog(paths), 'assets/retained': 'authored' });
  const one = openMirror(first, { repo, env });
  mkdirSync(join(one.dir, 'assets'), { recursive: true });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/rows.json'), 'metadata');
  writeFileSync(join(one.dir, 'assets/creature'), 'blob');
  one.release();
  const two = openMirror(first, { repo, env });
  expect(readFileSync(join(two.dir, 'assets/creature'), 'utf8')).toBe('blob');
  expect(readFileSync(join(two.dir, 'dist/rows.json'), 'utf8')).toBe('metadata');
  rmSync(join(two.dir, 'assets/creature'));
  two.release();
  const partial = openMirror(first, { repo, env });
  expect(existsSync(join(partial.dir, 'dist/rows.json'))).toBe(false);
  expect(readFileSync(join(partial.dir, 'assets/retained'), 'utf8')).toBe('authored');
  writeFileSync(join(partial.dir, 'dist/rows.json'), 'metadata');
  writeFileSync(join(partial.dir, 'assets/creature'), 'blob');
  partial.release();
  const second = commit({ 'scripts/generation-jobs.json': catalog(['assets/retained']) });
  const retired = openMirror(second, { repo, env });
  expect(existsSync(join(retired.dir, 'dist/rows.json'))).toBe(false);
  expect(existsSync(join(retired.dir, 'assets/creature'))).toBe(false);
  expect(readFileSync(join(retired.dir, 'assets/retained'), 'utf8')).toBe('authored');
  retired.release();
  // Git removes a formerly tracked blob when it becomes a generated output.
  // Its remaining ignored metadata must not survive as a seemingly ready job.
  const third = commit({ 'scripts/generation-jobs.json': catalog(['dist/rows.json', 'assets/retained']), 'assets/retained': null });
  writeFileSync(join(retired.dir, 'dist/rows.json'), 'stale metadata');
  const migrated = openMirror(third, { repo, env });
  expect(existsSync(join(migrated.dir, 'dist/rows.json'))).toBe(false);
  expect(existsSync(join(migrated.dir, 'assets/retained'))).toBe(false);
  migrated.release();
});

it('clears generated jobs when a released source overlay could have produced them', () => {
  const { repo, commit, env } = fixture();
  const outputs = ['dist/ecology.generated.json', 'dist/companion.json', 'assets/retained'];
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [{ buildTimeOutputs: outputs }] }), 'src/generator.ts': 'HEAD source', 'assets/retained': 'authored' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, outputs[0] ?? ''), 'HEAD ecology');
  writeFileSync(join(one.dir, outputs[1] ?? ''), 'HEAD companion');
  one.release();
  const overlay = openMirror(sha, { repo, env });
  writeFileSync(join(overlay.dir, 'src/generator.ts'), 'unlanded projection source');
  writeFileSync(join(overlay.dir, outputs[0] ?? ''), '{"projection":true}');
  overlay.release();
  const next = openMirror(sha, { repo, env });
  try {
    expect(readFileSync(join(next.dir, 'src/generator.ts'), 'utf8')).toBe('HEAD source');
    expect(existsSync(join(next.dir, outputs[0] ?? ''))).toBe(false);
    expect(existsSync(join(next.dir, outputs[1] ?? ''))).toBe(false);
    expect(readFileSync(join(next.dir, 'assets/retained'), 'utf8')).toBe('authored');
    expect(readFileSync(join(repo, 'src/generator.ts'), 'utf8')).toBe('HEAD source');
  } finally { next.release(); }
});

it('clears a whole generated job after an output-only overlay, retaining untouched jobs', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [
    { buildTimeOutputs: ['dist/ecology.generated.json', 'dist/companion.json'] },
    { buildTimeOutputs: ['dist/unrelated.json'] },
  ] }), 'src/source.ts': 'HEAD' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  for (const file of ['ecology.generated.json', 'companion.json', 'unrelated.json']) writeFileSync(join(one.dir, 'dist', file), 'HEAD output');
  one.release();
  const overlay = openMirror(sha, { repo, env });
  const ecology = join(overlay.dir, 'dist/ecology.generated.json'), before = lstatSync(ecology);
  writeFileSync(ecology, 'evil output'); // Same size as HEAD output; restoring mtime still changes ctime.
  utimesSync(ecology, before.atime, before.mtime);
  writeFileSync(join(overlay.dir, 'dist/unrelated.json'), 'HEAD output'); // A normal byte-identical rewrite remains reusable.
  overlay.release();
  const next = openMirror(sha, { repo, env });
  try {
    expect(existsSync(join(next.dir, 'dist/ecology.generated.json'))).toBe(false);
    expect(existsSync(join(next.dir, 'dist/companion.json'))).toBe(false);
    expect(readFileSync(join(next.dir, 'dist/unrelated.json'), 'utf8')).toBe('HEAD output');
  } finally { next.release(); }
});

it('detects source overlays left behind before the next sync resets tracked files', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [{ buildTimeOutputs: ['dist/rows.json'] }] }), 'src/source.ts': 'HEAD' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/rows.json'), 'HEAD rows');
  one.release();
  // Model an interrupted overlay owner that never ran its release cleanup.
  writeFileSync(join(one.dir, 'src/source.ts'), 'overlay');
  writeFileSync(join(one.dir, 'dist/rows.json'), 'overlay rows');
  const next = openMirror(sha, { repo, env });
  try {
    expect(readFileSync(join(next.dir, 'src/source.ts'), 'utf8')).toBe('HEAD');
    expect(existsSync(join(next.dir, 'dist/rows.json'))).toBe(false);
  } finally { next.release(); }
});

it('also invalidates source-generation tables while preserving tracked outputs', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'scripts/source-generation-outputs.json': JSON.stringify({ producers: {
    'scripts/gen.mjs': ['dist/discovery.generated.ts', 'src/retained.ts'],
  } }), 'src/retained.ts': 'authored' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/discovery.generated.ts'), 'HEAD discovery');
  one.release();
  const overlay = openMirror(sha, { repo, env });
  writeFileSync(join(overlay.dir, 'dist/discovery.generated.ts'), 'overlay discovery');
  overlay.release();
  const next = openMirror(sha, { repo, env });
  try {
    expect(existsSync(join(next.dir, 'dist/discovery.generated.ts'))).toBe(false);
    expect(readFileSync(join(next.dir, 'src/retained.ts'), 'utf8')).toBe('authored');
  } finally { next.release(); }
});

it('rejects an abandoned output-only overlay against the saved slot baseline', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [{ buildTimeOutputs: ['dist/rows.json'] }] }), 'src/source.ts': 'HEAD' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/rows.json'), 'HEAD rows');
  one.release();
  writeFileSync(join(one.dir, 'dist/rows.json'), 'abandoned overlay');
  const next = openMirror(sha, { repo, env });
  try { expect(existsSync(join(next.dir, 'dist/rows.json'))).toBe(false); }
  finally { next.release(); }
});

it('discards complete legacy generated groups without a slot baseline', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [{ buildTimeOutputs: ['dist/rows.json'] }] }), 'src/source.ts': 'HEAD' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/rows.json'), 'unproven legacy rows');
  one.release();
  rmSync(join(dirname(one.dir), 'generated-outputs.json'));
  const next = openMirror(sha, { repo, env });
  try { expect(existsSync(join(next.dir, 'dist/rows.json'))).toBe(false); }
  finally { next.release(); }
});


it('invalidates a producer whose output disappears while its snapshot is being hashed', () => {
  const { repo, commit, env } = fixture();
  const first = 'dist/rows.generated.json', second = 'dist/companion.generated.json', connected = 'dist/connected.generated.json', unrelated = 'dist/unrelated.json';
  const sha = commit({ 'scripts/generation-jobs.json': JSON.stringify({ jobs: [
    { buildTimeOutputs: [first, connected] },
    { buildTimeOutputs: [first, second, 'assets/retained'] }, { buildTimeOutputs: [unrelated] },
  ] }), 'assets/retained': 'authored' });
  const one = openMirror(sha, { repo, env });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  for (const file of [first, second, connected, unrelated]) writeFileSync(join(one.dir, file), 'verified output');
  one.release();
  const original = new InputHashMemo(one.dir), hash = original.hash.bind(original);
  let calls = 0, removed = false;
  const racing = vi.spyOn(InputHashMemo.prototype, 'hash').mockImplementation((path: string, fresh = false) => {
    // Two producer groups check the baseline before the new snapshot hashes it.
    if (path === first && ++calls === 3) { rmSync(join(one.dir, second)); removed = true; }
    return hash(path, fresh);
  });
  try {
    const next = openMirror(sha, { repo, env });
    try {
      expect(removed).toBe(true);
      expect(existsSync(join(next.dir, first))).toBe(false); expect(existsSync(join(next.dir, second))).toBe(false);
      expect(existsSync(join(next.dir, connected))).toBe(false);
      expect(readFileSync(join(next.dir, 'assets/retained'), 'utf8')).toBe('authored');
      expect(readFileSync(join(next.dir, unrelated), 'utf8')).toBe('verified output');
      const saved: unknown = JSON.parse(readFileSync(join(dirname(next.dir), 'generated-outputs.json'), 'utf8'));
      expect(saved).toEqual({ schema: 1, root: next.dir, outputs: { [unrelated]: hash(unrelated) } });
    } finally { next.release(); }
    expect(existsSync(join(env['WILDSHARD_BUILD_MIRROR'] ?? '', 'check.lock'))).toBe(false);
    expect(readFileSync(join(repo, 'assets/retained'), 'utf8')).toBe('authored');
  } finally { racing.mockRestore(); }
});

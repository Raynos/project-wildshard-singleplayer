import { describe, expect, it } from 'vitest';
import { failedSteps, failingTestFiles, failureCommands, newestPassing, newerTestFix, probeFailure, probeSnapshot } from '../scripts/green-prefix.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Probe real archived fixture commits without touching shared Git state.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The focused-check fixture owns and deletes its temporary files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the owned Git fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths for real archived probes.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the owned pusher fixture's environment from bypass flags.
import process from 'node:process';

// SF74 W25: a red push gate still pushes the newest unpushed verified regeneration commit where the failing files pass.
const GATE = [
  '  ✓ oxlint (73 s)',
  '  ✗ vitest (259 s)',
  '  ✓ vite-build (31 s)',
  '── vitest ──',
  ' FAIL  |unit| test/baked-maps.test.ts > baked maps (SF66) > pine-hollow: the shipped map matches its world',
  ' FAIL  |unit| test/proof/pine-hollow/headless.test.ts > walks the dam leg through native gameplay',
  ' FAIL  |unit| test/baked-maps.test.ts > baked maps (SF66) > nine-dragon-stack: the shipped map matches its world',
  ' FAIL  test/plain.test.ts > no project label',
].join('\n');

describe('green prefix', () => {
  it.each([false, true])('regenerates and gates one repair, then stops retrying a second red (%s)', secondRed => {
    const root = mkdtempSync(join(tmpdir(), 'push-main-newer-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
      git('init', '-q', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
      mkdirSync(join(root, 'test')); mkdirSync(join(root, 'scripts'));
      const file = join(root, 'test/repair.test.ts');
      const commit = (text: string) => {
        writeFileSync(file, text); git('add', 'test/repair.test.ts');
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture');
        return git('rev-parse', 'HEAD');
      };
      const base = commit('base'), red = commit('red'), first = commit('first repair'), second = commit('second repair');
      // The only push target is an owned temporary bare repository, never GitHub.
      const remote = join(root, 'remote.git'); git('init', '-q', '--bare', remote);
      git('remote', 'add', 'origin', remote); git('update-ref', 'refs/heads/main', base); git('push', '-q', 'origin', 'main');
      git('update-ref', 'refs/heads/main', red);
      for (const name of ['push-main.sh', 'green-prefix.mjs', 'link-node-modules.mjs']) {
        writeFileSync(join(root, 'scripts', name), readFileSync(join('scripts', name)));
      }
      writeFileSync(join(root, 'scripts/regenerate-committed.mjs'), `
import { appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const tip = execFileSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).trim();
writeFileSync(process.env.REGEN_SHA_FILE, tip); appendFileSync('.git/regens', tip + '\\n');
`);
      writeFileSync(join(root, 'scripts/vercel-tree-gate.sh'), `
count=0
[ ! -f .git/gates ] || count=$(wc -l < .git/gates)
printf '%s\\n' "$1" >> .git/gates
if [ "$count" -eq 0 ]; then
  git update-ref refs/heads/main ${first}
elif [ "$count" -eq 1 ] && [ "${secondRed}" = true ]; then
  git update-ref refs/heads/main ${second}
else
  exit 0
fi
printf '  ✗ vitest (1 s)\\n FAIL test/repair.test.ts > exact assertion\\n'
exit 1
`);
      const run = spawnSync('bash', ['scripts/push-main.sh', '--locked'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, GREEN_PREFIX: '0', SKIP_VERCEL_GATE: '0' }, timeout: 10_000,
      });
      expect(run.error).toBeUndefined(); expect(run.status, run.stdout + run.stderr).toBe(secondRed ? 1 : 0);
      expect(readFileSync(join(root, '.git/gates'), 'utf8').trim().split('\n')).toEqual([red, first]);
      expect(readFileSync(join(root, '.git/regens'), 'utf8').trim().split('\n').slice(0, 2)).toEqual([red, first]);
      expect(run.stdout.match(/retrying regeneration and complete gate once/gu)).toHaveLength(1);
      expect(git('rev-parse', 'origin/main')).toBe(secondRed ? base : first);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('retries only a committed descendant test edit, refusing unrelated, working, deleted or mixed failures', () => {
    const root = mkdtempSync(join(tmpdir(), 'green-prefix-newer-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const redOutput = '  ✗ vitest (10 s)\n FAIL test/repair.test.ts > real failing assertion';
    const commit = () => {
      git('add', '.');
      git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
      return git('rev-parse', 'HEAD');
    };
    try {
      git('init', '-q', '-b', 'main'); mkdirSync(join(root, 'test'));
      const file = join(root, 'test/repair.test.ts'); writeFileSync(file, 'red'); const red = commit();
      expect(newerTestFix(root, red, redOutput)).toBeNull();
      writeFileSync(join(root, 'unrelated'), 'new'); commit();
      writeFileSync(file, 'working repair');
      expect(newerTestFix(root, red, redOutput)).toBeNull();
      const fixed = commit();
      expect(newerTestFix(root, red, redOutput)).toBe(fixed);
      for (const out of [`${redOutput}\n  ✗ typecheck (1 s)`, '  ✗ vitest (1 s)', redOutput.replace('test/repair', '../test/repair')]) {
        expect(newerTestFix(root, red, out)).toBeNull();
      }
      expect(newerTestFix(root, 'missing-ref', redOutput)).toBeNull();
      rmSync(file); commit();
      expect(newerTestFix(root, red, redOutput)).toBeNull();
      git('checkout', '-q', '--orphan', 'separate'); writeFileSync(file, 'unrelated history'); const separate = commit();
      expect(newerTestFix(root, separate, redOutput)).toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('probes mixed native-bake and typed failures with exact focused commands and refuses unsupported steps', () => {
    const commands = failureCommands(['typecheck-api', 'typecheck-layers', 'bake-nine-physics', 'vitest']);
    expect(commands?.map(command => command.slice(1))).toEqual([
      ['exec', 'tsc', '--noEmit', '-p', 'api'], ['exec', 'tsc', '-b', 'tsconfig.layers.json'],
      ['scripts/bake-check.mjs', '--node-only', '--only=nine-physics'],
    ]);
    for (const step of ['vite-build', 'webkit-smoke', 'generated', 'bake-nine;echo']) expect(failureCommands(['vitest', step])).toBeNull();
  });
  it('finds a real non-vitest break from committed bytes, ignoring working edits and absent test files', () => {
    const root = mkdtempSync(join(tmpdir(), 'green-prefix-focused-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
      git('init', '-q'); mkdirSync(join(root, 'scripts'));
      const script = join(root, 'scripts/check-css.mjs');
      const commit = () => {
        git('add', 'scripts/check-css.mjs');
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
        return git('rev-parse', 'HEAD');
      };
      writeFileSync(script, 'process.exit(0);'); const good = commit();
      writeFileSync(script, 'process.exit(1);'); const bad = commit();
      writeFileSync(script, 'process.exit(0);');
      const commands = failureCommands(['check-css']);
      if (commands === null) throw new Error('Missing focused CSS command');
      expect(newestPassing([good, bad], sha => probeFailure(root, sha, ['test/not-yet.test.ts'], commands))).toBe(0);
      expect(probeFailure(root, good, [], [[commands[0]?.[0] ?? '', 'scripts/missing.mjs']])).toBe(false);
      let kept: {work: string; snapshot: string} | undefined;
      try {
        expect(probeFailure(root, good, [], commands, (work, snapshot) => { kept = {work, snapshot}; })).toBe(true);
        if (kept === undefined) throw new Error('Passing exact-SHA export was not retained');
        expect(readFileSync(join(kept.work, 'scripts/check-css.mjs'), 'utf8')).toBe('process.exit(0);');
        expect(probeSnapshot(kept.work)).toBe(kept.snapshot);
        writeFileSync(join(kept.work, 'scripts/check-css.mjs'), 'process.exit(1);');
        expect(probeSnapshot(kept.work)).not.toBe(kept.snapshot);
      } finally { if (kept !== undefined) rmSync(kept.work, { recursive: true, force: true }); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('refuses added, deleted, renamed or changed export inputs before reuse', () => {
    const root = mkdtempSync(join(tmpdir(), 'green-prefix-fingerprint-'));
    try {
      const input = join(root, 'input'); writeFileSync(input, 'pinned');
      const pinned = probeSnapshot(root);
      expect(probeSnapshot(root)).toBe(pinned);
      writeFileSync(join(root, 'added'), 'new'); expect(probeSnapshot(root)).not.toBe(pinned);
      rmSync(join(root, 'added')); expect(probeSnapshot(root)).toBe(pinned);
      renameSync(input, join(root, 'moved')); expect(probeSnapshot(root)).not.toBe(pinned);
      renameSync(join(root, 'moved'), input); expect(probeSnapshot(root)).toBe(pinned);
      writeFileSync(input, 'changed'); expect(probeSnapshot(root)).not.toBe(pinned);
      rmSync(input); expect(probeSnapshot(root)).not.toBe(pinned);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('reads the failed steps and the failing test files from the gate output', () => {
    expect(failedSteps(GATE)).toEqual(['vitest']);
    expect(failingTestFiles(GATE)).toEqual(['test/baked-maps.test.ts', 'test/plain.test.ts', 'test/proof/pine-hollow/headless.test.ts']);
    expect(failedSteps('  ✗ typecheck (12 s)\n  ✗ vitest (1 s)')).toEqual(['typecheck', 'vitest']);
  });
  it('finds the newest passing candidate in log2 probes', () => {
    const shas = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let brk = 0; brk <= shas.length; brk++) {
      const probed: string[] = [];
      const index = newestPassing(shas, (sha) => { probed.push(sha); return shas.indexOf(sha) < brk; });
      expect(index).toBe(brk - 1);
      expect(probed.length).toBeLessThanOrEqual(3);
    }
    expect(newestPassing([], () => true)).toBe(-1);
  });
});

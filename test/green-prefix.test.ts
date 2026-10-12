import { describe, expect, it } from 'vitest';
import { failedSteps, failingTestFiles, failingLintFiles, failureCommands, newestPassing, newerGateFix, probeFailure, probeSnapshot } from '../scripts/green-prefix.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Probe real archived fixture commits without touching shared Git state.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The focused-check fixture owns and deletes its temporary files.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
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
  it.each([false, true])('skips idle regeneration and carries a commit arriving during a green gate: %s', (arriving) => {
    const root = mkdtempSync(join(tmpdir(), 'push-main-idle-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
      git('init', '-q', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
      const commit = (text: string) => {
        writeFileSync(join(root, 'source.txt'), text); git('add', 'source.txt');
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture');
        return git('rev-parse', 'HEAD');
      };
      const base = commit('base'), first = commit('first'), second = commit('second');
      const remote = join(root, 'remote.git'); git('init', '-q', '--bare', remote);
      git('remote', 'add', 'origin', remote); git('update-ref', 'refs/heads/main', base); git('push', '-q', 'origin', 'main');
      if (arriving) git('update-ref', 'refs/heads/main', first);
      mkdirSync(join(root, 'scripts'));
      writeFileSync(join(root, 'scripts/push-main.sh'), readFileSync('scripts/push-main.sh'));
      writeFileSync(join(root, 'scripts/regenerate-committed.mjs'), `
import { appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const tip = execFileSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).trim();
writeFileSync(process.env.REGEN_SHA_FILE, tip); appendFileSync('.git/regens', tip + '\\n');
`);
      writeFileSync(join(root, 'scripts/vercel-tree-gate.sh'), `
printf '%s\\n' "$1" >> .git/gates
if [ "$1" = '${first}' ]; then git update-ref refs/heads/main ${second}; fi
exit 0
`);
      const run = spawnSync('bash', ['scripts/push-main.sh', '--locked'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, SKIP_VERCEL_GATE: '0' }, timeout: 10_000,
      });
      expect(run.error).toBeUndefined(); expect(run.status, run.stdout + run.stderr).toBe(0);
      const lines = (name: string) => existsSync(join(root, '.git', name))
        ? readFileSync(join(root, '.git', name), 'utf8').trim().split('\n') : [];
      const expected = arriving ? [first, second] : [];
      expect(lines('regens')).toEqual(expected); expect(lines('gates')).toEqual(expected);
      expect(git('rev-parse', 'origin/main')).toBe(arriving ? second : base);
      expect(run.stdout).toContain('origin/main has every local commit');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it.each([['vitest', false, false], ['vitest', true, false], ['oxlint', false, false], ['oxlint', true, false], ['oxlint', false, true], ['oxlint', true, true]] as const)('regenerates and gates one %s repair, then stops retrying a second red (%s), repair during prefix (%s)', (step, secondRed, duringPrefix) => {
    const root = mkdtempSync(join(tmpdir(), 'push-main-newer-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
      git('init', '-q', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
      mkdirSync(join(root, 'test')); mkdirSync(join(root, 'scripts'));
      const relative = step === 'vitest' ? 'test/repair.test.ts' : 'scripts/repair.mjs';
      const file = join(root, relative);
      const commit = (text: string) => {
        writeFileSync(file, text); git('add', relative);
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
      if (duringPrefix) {
        // Control only the probe timing; use the real committed-repair reader.
        writeFileSync(join(root, 'scripts/real-green-prefix.mjs'), readFileSync('scripts/green-prefix.mjs'));
        writeFileSync(join(root, 'scripts/green-prefix.mjs'), `
import { newerGateFix } from './real-green-prefix.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
if (process.argv[2] === '--retry-current-tip') {
  const sha = newerGateFix(process.cwd(), process.argv[3], readFileSync(process.argv[4], 'utf8'));
  if (sha !== null) console.log(sha);
} else if (execFileSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).trim() === '${red}') {
  execFileSync('git', ['update-ref', 'refs/heads/main', '${first}']);
  console.log('${base}');
}
`);
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
  if [ "${duringPrefix}" = false ]; then git update-ref refs/heads/main ${first}; fi
elif [ "$count" -eq 1 ] && [ "${secondRed}" = true ]; then
  git update-ref refs/heads/main ${second}
else
  exit 0
fi
printf '%s\\n' '  ✗ ${step} (1 s)' '${step === 'vitest' ? ' FAIL test/repair.test.ts > exact assertion' : '── oxlint ──'}' '${step === 'vitest' ? '' : 'scripts/repair.mjs:1:1: error test-rule: exact lint failure'}'
exit 1
`);
      const run = spawnSync('bash', ['scripts/push-main.sh', '--locked'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, GREEN_PREFIX: duringPrefix ? '1' : '0', SKIP_VERCEL_GATE: '0' }, timeout: 10_000,
      });
      expect(run.error).toBeUndefined(); expect(run.status, run.stdout + run.stderr).toBe(secondRed ? 1 : 0);
      expect(readFileSync(join(root, '.git/gates'), 'utf8').trim().split('\n')).toEqual([red, first]);
      expect(readFileSync(join(root, '.git/regens'), 'utf8').trim().split('\n')).toEqual([red, first]);
      expect(run.stdout.match(/retrying regeneration and complete gate once/gu)).toHaveLength(1);
      expect(git('rev-parse', 'origin/main')).toBe(secondRed ? base : first);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('retries committed named edits, refusing unsafe, working, deleted or unknown failures', () => {
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
      const file = join(root, 'test/repair.test.ts'); writeFileSync(file, 'red');
      mkdirSync(join(root, 'scripts'));
      const lintFile = join(root, 'scripts/repair.mjs');
      writeFileSync(lintFile, 'red lint'); const red = commit();
      const lintOutput = '  ✗ oxlint (10 s)\n── oxlint ──\nscripts/repair.mjs:1:1: error test-rule: exact lint failure\nvercel-gate: FAILED at fixture — oxlint';
      expect(newerGateFix(root, red, redOutput)).toBeNull();
      writeFileSync(join(root, 'unrelated'), 'new'); commit();
      writeFileSync(file, 'working repair');
      writeFileSync(lintFile, 'working lint repair');
      expect(newerGateFix(root, red, lintOutput)).toBeNull();
      expect(newerGateFix(root, red, redOutput)).toBeNull();
      const fixed = commit();
      expect(newerGateFix(root, red, redOutput)).toBe(fixed);
      expect(newerGateFix(root, red, lintOutput)).toBe(fixed);
      const mixed = `  ✗ vitest (10 s)\n  ✗ oxlint (1 s)\n  ✗ bake-sky-physics (1 s)\n── vitest ──\n FAIL test/repair.test.ts > real failure\n── oxlint ──\nscripts/repair.mjs:1:1: error test-rule: exact lint failure\n── bake-sky-physics ──\nbake-sky-physics: STALE src/shards/example/runtime/physics.baked.json\nvercel-gate: FAILED at fixture — vitest oxlint bake-sky-physics`;
      expect(failingLintFiles(mixed)).toEqual(['scripts/repair.mjs']);
      expect(newerGateFix(root, red, mixed)).toBe(fixed);
      for (const out of [`${lintOutput}\n  ✗ vitest (1 s)`, lintOutput.replace('scripts/repair', '../scripts/repair'), lintOutput.replace('scripts/repair', '/scripts/repair'), lintOutput.replace('scripts/repair', 'scripts//repair'), lintOutput.replace('error test-rule', 'warning test-rule'), lintOutput.replace('scripts/repair.mjs:1:1:', 'unparsed lint refusal:')]) {
        expect(newerGateFix(root, red, out)).toBeNull();
      }
      expect(newerGateFix(root, red, `${redOutput}\n  ✗ typecheck (1 s)`)).toBe(fixed);
      for (const out of [`${redOutput}\n  ✗ vite-build (1 s)`, '  ✗ vitest (1 s)', redOutput.replace('test/repair', '../test/repair')]) {
        expect(newerGateFix(root, red, out)).toBeNull();
      }
      expect(newerGateFix(root, 'missing-ref', redOutput)).toBeNull();
      rmSync(file); rmSync(lintFile); commit();
      expect(newerGateFix(root, red, lintOutput)).toBeNull();
      expect(newerGateFix(root, red, redOutput)).toBeNull();
      git('checkout', '-q', '--orphan', 'separate'); writeFileSync(file, 'unrelated history'); const separate = commit();
      expect(newerGateFix(root, separate, redOutput)).toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('earns a complete retry for committed source and catalogue repairs without editing failing tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'green-prefix-source-repair-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
    const output = '  ✗ vitest (10 s)\n  ✗ bake-sky-physics (1 s)\n FAIL test/repair.test.ts > exact source and bake inputs';
    try {
      git('init', '-q', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
      git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
      for (const dir of ['src', 'scripts', 'test']) mkdirSync(join(root, dir));
      const source = join(root, 'src/producer.ts'), catalogue = join(root, 'scripts/generation-jobs.json');
      writeFileSync(source, 'red source'); writeFileSync(catalogue, '{"jobs":[]}');
      writeFileSync(join(root, 'test/repair.test.ts'), 'unchanged complete refusal');
      const red = commit();
      writeFileSync(join(root, 'README.md'), 'docs only'); commit();
      writeFileSync(source, 'working repair');
      expect(newerGateFix(root, red, output)).toBeNull();
      const repairedSource = commit();
      expect(newerGateFix(root, red, output)).toBe(repairedSource);
      expect(git('diff', red, repairedSource, '--', 'test')).toBe('');
      writeFileSync(catalogue, '{"jobs":[{"id":"complete-inputs"}]}');
      const repairedCatalogue = commit();
      expect(newerGateFix(root, repairedSource, output)).toBe(repairedCatalogue);
      expect(newerGateFix(root, repairedSource, '  ✗ typecheck (1 s)')).toBe(repairedCatalogue);
      expect(newerGateFix(root, repairedSource, `${output}\n  ✗ webkit-smoke (1 s)`)).toBeNull();
      rmSync(join(root, 'test/repair.test.ts')); commit();
      expect(newerGateFix(root, red, output)).toBeNull();
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
    expect(failingLintFiles('── oxlint ──\nscripts/probe.mjs:46:58: error typescript(no-unnecessary-condition): message\nvercel-gate: FAILED at sha — oxlint')).toEqual(['scripts/probe.mjs']);
    expect(failingLintFiles('── oxlint ──\nunparsed refusal')).toEqual([]);
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

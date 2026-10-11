import { describe, expect, it } from 'vitest';
import { failedSteps, failingTestFiles, failureCommands, newestPassing, probeFailure, probeSnapshot } from '../scripts/green-prefix.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Probe real archived fixture commits without touching shared Git state.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The focused-check fixture owns and deletes its temporary files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the owned Git fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths for real archived probes.
import { join } from 'node:path';

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

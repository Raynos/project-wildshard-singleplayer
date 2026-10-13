// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual archive block in an isolated Git fixture.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The archive fixture owns all of its temporary paths.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Bound fixture and repository paths.
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('archives absent or committed optional content roots without reading working-tree replacements', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'admin-archive-'));
  try {
    const repo = resolve(fixture, 'repo'); mkdirSync(repo);
    const git = (...args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
    git('init', '--quiet'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    for (const dir of ['admin', 'src', 'scripts', 'lint', 'public', 'test']) {
      mkdirSync(resolve(repo, dir)); writeFileSync(resolve(repo, dir, 'retained.txt'), 'retained');
    }
    for (const file of ['tsconfig.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) writeFileSync(resolve(repo, file), '{}');
    git('add', '.'); git('commit', '--quiet', '-m', 'fixture');
    const script = readFileSync(resolve(import.meta.dirname, '../admin/tools/deploy.sh'), 'utf8');
    const start = script.indexOf('share=('), end = script.indexOf('node scripts/link-node-modules.mjs', start);
    if (start === -1 || end < start) throw new Error('Missing actual admin archive block');
    const archive = (destination: string): void => {
      mkdirSync(destination);
      execFileSync('bash', ['-c', `set -euo pipefail; cd "$1"; full="$2"; work="$3"; reports=(admin);\n${script.slice(start, end)}`, 'admin-fixture', repo, git('rev-parse', 'HEAD'), destination]);
    };
    const absent = resolve(fixture, 'absent'); archive(absent);
    expect(readFileSync(resolve(absent, 'src/retained.txt'), 'utf8')).toBe('retained');
    expect(existsSync(resolve(absent, 'music'))).toBe(false);
    mkdirSync(resolve(repo, 'music')); writeFileSync(resolve(repo, 'music/score.txt'), 'committed score');
    git('add', 'music'); git('commit', '--quiet', '-m', 'score');
    writeFileSync(resolve(repo, 'music/score.txt'), 'foreign working score');
    const present = resolve(fixture, 'present'); archive(present);
    expect(readFileSync(resolve(present, 'music/score.txt'), 'utf8')).toBe('committed score');
    expect(existsSync(resolve(present, 'sfx'))).toBe(false);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

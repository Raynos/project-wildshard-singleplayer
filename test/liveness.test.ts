// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the CLI in an isolated fixture repository.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only temporary fixture files are created or removed.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the system temporary directory for fixture repositories.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture and scanner paths portably.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the scanner through its absolute module path.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the Node version running the tests.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/normalize/liveness.mjs', import.meta.url));
const NOW = '2026-09-30T23:00:00Z';
interface Report { dead: string[]; entries: { name: string; reasons: string[] }[] }
function fixture(files: Record<string, string>, commands: { command: string; timestamp?: string; codex?: boolean }[] = []): Report {
  const root = mkdtempSync(join(tmpdir(), 'wildshard-liveness-'));
  try {
    const put = (path: string, text: string): void => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
    put('scripts/dead.mjs', '');
    for (const [path, text] of Object.entries(files)) put(path, text);
    put('transcripts/run.jsonl', commands.map(row => JSON.stringify(row.codex ? {
      timestamp: row.timestamp ?? NOW, type: 'response_item', cwd: root,
      payload: { type: 'custom_tool_call', name: 'functions.exec', input: `text(await tools.exec_command({cmd:${JSON.stringify(row.command)}}));` },
    } : {
      timestamp: row.timestamp ?? NOW, type: 'assistant', cwd: root,
      message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: row.command } }] },
    })).join('\n'));
    const out = spawnSync(execPath, [SCRIPT, '--dry-run', '--json', `--root=${root}`, `--home=${join(root, 'home')}`, `--transcripts=${join(root, 'transcripts')}`, `--now=${NOW}`], { encoding: 'utf8' });
    if (out.error) throw out.error;
    expect(out.status, out.stderr).toBe(0);
    return JSON.parse(out.stdout) as Report;
  } finally { rmSync(root, { force: true, recursive: true }); }
}

describe('decision-88 script liveness', () => {
  it('ignores asks and historical audits, and follows living references to a fixpoint', () => {
    const report = fixture({
      'docs/tasks/asks/E42.md': '**Status:** open\n scripts/history.mjs',
      'docs/audits/history.md': 'scripts/history.mjs',
      'project/archive/old.md': 'scripts/history.mjs',
      'scripts/history.mjs': '',
      'docs/plans/ACTIVE.md': 'scripts/root.mjs',
      'scripts/root.mjs': "import './child.mjs';",
      'scripts/root.d.mts': 'export {};',
      'scripts/child.mjs': "import './leaf.mjs';",
      'scripts/leaf.mjs': '',
      'scripts/orphan.mjs': "import './history.mjs';",
    });
    expect(report.dead).toEqual(['scripts/dead.mjs', 'scripts/history.mjs', 'scripts/orphan.mjs']);
    expect(report.entries.find(row => row.name === 'root.d.mts')?.reasons).toContain('declaration beside live module');
  });

  it('recognizes wrappers, interpreter options, executable paths and Codex orchestration', () => {
    const names = ['lock', 'caffeine', 'timeout', 'lane', 'model', 'uv', 'pnpm', 'npx', 'direct', 'codex', 'shell'];
    const report = fixture(Object.fromEntries(names.map(name => [`scripts/${name}.mjs`, ''])), [
      { command: 'lockf -k /tmp/model.lock node --import ./loader.mjs scripts/lock.mjs' },
      { command: 'caffeinate -i -t 30 node scripts/caffeine.mjs' },
      { command: 'timeout 60 bash scripts/timeout.mjs' },
      { command: 'scripts/browser-lane.sh --max 3 node scripts/lane.mjs' },
      { command: '/tmp/run-locked.sh /tmp/log python3 scripts/model.mjs' },
      { command: 'uv run --python 3.13 --no-project python3 scripts/uv.mjs' },
      { command: 'pnpm exec -- node --experimental-transform-types scripts/pnpm.mjs' },
      { command: 'npx --yes --package node node scripts/npx.mjs' },
      { command: './scripts/direct.mjs' },
      { command: 'node scripts/codex.mjs', codex: true },
      { command: 'bash -lc "node scripts/shell.mjs"' },
    ]);
    expect(report.dead).toEqual(['scripts/dead.mjs']);
  });

  it('excludes reads, old executions, and executions of finished one-off asks', () => {
    const report = fixture({
      'scripts/read.mjs': '', 'scripts/old.mjs': '', 'scripts/e12-closed.mjs': '', 'scripts/E13-dropped.mjs': '', 'scripts/e14-open.mjs': '',
      'docs/tasks/asks/E12.md': '**Status:** done (2026-09-29)',
      'docs/tasks/ASKS.md': '| E13 | words | dropped (2026-09-20) |',
      'docs/tasks/asks/E14.md': '**Status:** in flight',
    }, [
      { command: 'cat scripts/read.mjs; sed -n 1p scripts/read.mjs; rg scripts/read.mjs docs' },
      { command: 'node scripts/old.mjs', timestamp: '2026-09-25T22:59:59Z' },
      { command: 'node scripts/e12-closed.mjs; node scripts/E13-dropped.mjs; node scripts/e14-open.mjs' },
    ]);
    expect(report.dead).toEqual(['scripts/dead.mjs', 'scripts/E13-dropped.mjs', 'scripts/e12-closed.mjs', 'scripts/old.mjs', 'scripts/read.mjs'].sort((a, b) => a.localeCompare(b)));
  });

  it('preserves referenced finished one-offs and folders, but the generated index does not resurrect dead scripts', () => {
    const report = fixture({
      'AGENTS.md': 'scripts/e12-closed.mjs scripts/build/run.py',
      'docs/tasks/asks/E12.md': '**Status:** done',
      'scripts/e12-closed.mjs': '', 'scripts/build/run.py': '',
      'scripts/README.md': 'scripts/dead.mjs',
    });
    expect(report.dead).toEqual(['scripts/dead.mjs']);
  });

  it('recognizes abbreviated doc filenames and named families without treating inventory globs as references', () => {
    const report = fixture({
      'docs/design/tools.md': '`scripts/**` is the inventory. Use `scripts/family-*.mjs`; also `short.mjs`.',
      'scripts/family-one.mjs': '', 'scripts/family-two.mjs': '', 'scripts/short.mjs': '',
    });
    expect(report.dead).toEqual(['scripts/dead.mjs']);
  });

  it('generates a stable index and refuses it after the surviving entries change', () => {
    const root = mkdtempSync(join(tmpdir(), 'wildshard-liveness-readme-'));
    try {
      mkdirSync(join(root, 'scripts'));
      writeFileSync(join(root, 'scripts/check-one.mjs'), '');
      const run = (...args: string[]): number | null => spawnSync(execPath, [SCRIPT, `--root=${root}`, '--readme', ...args], { encoding: 'utf8' }).status;
      expect(run('--check')).toBe(1);
      expect(run()).toBe(0);
      expect(run('--check')).toBe(0);
      writeFileSync(join(root, 'scripts/new-tool.mjs'), '');
      expect(run('--check')).toBe(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

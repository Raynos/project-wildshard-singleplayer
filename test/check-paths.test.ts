// oxlint-disable-next-line import/no-nodejs-modules -- The CLI contract test needs the scanner's exit status and output.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Plant failures in an isolated temporary tree, never in the shared checkout.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture tree belongs in the operating system's temporary folder.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct platform-correct paths for fixture files.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the scanner by its absolute module path from a fixture cwd.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- The scanner must use the same Node version as vitest.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/check-paths.mjs', import.meta.url));
function scan(files: Record<string, string>): { status: number | null; output: string } {
  const root = mkdtempSync(join(tmpdir(), 'wildshard-paths-'));
  try {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    const out = spawnSync(execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
    if (out.error) throw out.error;
    return { status: out.status, output: out.stdout + out.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe('check-paths CLI on a temporary repository', () => {
  it('names a planted missing script path and exits 1', () => {
    const out = scan({ 'scripts/plant.mjs': "const path = 'src/planted-missing.ts';" });
    expect(out.status).toBe(1);
    expect(out.output).toContain('scripts/plant.mjs:1: missing path src/planted-missing.ts');
  });
  it('checks shard-owned Node baker paths after tooling moves into generators', () => {
    const out = scan({ 'src/shards/alpha/generators/bake.mjs': "const path = 'src/planted-missing.ts';" });
    expect(out.status).toBe(1);
    expect(out.output).toContain('src/shards/alpha/generators/bake.mjs:1: missing path src/planted-missing.ts');
  });
  it('names a planted empty code glob and exits 1', () => {
    const out = scan({ 'test/plant.test.ts': "const modules = import.meta.glob<string>(['../src/planted-empty/*.ts', '!../src/ignored.ts']);" });
    expect(out.status).toBe(1);
    expect(out.output).toContain('empty glob ../src/planted-empty/*.ts');
    expect(out.output).not.toContain('ignored.ts');
  });
  it('accepts existing literals, brace globs and relative code globs; skips dynamic templates and comments', () => {
    const out = scan({
      'src/a.ts': 'export const a = 1;',
      // oxlint-disable-next-line no-template-curly-in-string -- This is the planted source text of a dynamic template, not a test interpolation.
      'scripts/check.mjs': "const paths = ['src/a.ts', './src/*.{ts,js}']; const dynamic = `src/${name}.ts`; // 'src/history.ts'",
      'test/scan.test.ts': "const modules = import.meta.glob(['../src/*.ts', '!../src/missing.ts']);",
      'scripts/check.sh': 'cat src/a.ts # src/deleted.ts\n',
    });
    expect(out.status).toBe(0);
  });
  it('checks an unquoted shell or Python source path', () => {
    for (const extension of ['sh', 'py']) {
      const out = scan({ [`scripts/plant.${extension}`]: 'tool src/unquoted-missing.ts' });
      expect(out.status).toBe(1);
      expect(out.output).toContain('missing path src/unquoted-missing.ts');
    }
  });
  it('checks every pattern with nested generics and bracket expressions, ignoring calls quoted as source text', () => {
    const out = scan({
      'src/a.ts': '',
      'test/scan.test.ts': "const fake = \"import.meta.glob('../quoted-only/*.ts')\";\nconst files = import.meta.glob<Record<string, unknown>>(['../src/[ab].ts', '../src/planted-empty/*.ts']);",
    });
    expect(out.status).toBe(1);
    expect(out.output).toContain('empty glob ../src/planted-empty/*.ts');
    expect(out.output).not.toContain('empty glob ../src/[ab].ts');
    expect(out.output).not.toContain('quoted-only');
  });
  it('allows deliberate prefixes with a reason, but refuses stale and reasonless allowances', () => {
    const entry = { path: 'src/future/', file: 'scripts/check.mjs', why: 'A prefix comparison, not a file.' };
    const files = { 'scripts/check.mjs': "const prefix = 'src/future/';" };
    expect(scan({ ...files, 'scripts/check-paths.allow.json': JSON.stringify([entry]) }).status).toBe(0);
    const stale = scan({ 'scripts/check-paths.allow.json': JSON.stringify([entry]) });
    expect(stale.status).toBe(1);
    expect(stale.output).toContain('stale allowance');
    expect(scan({ ...files, 'scripts/check-paths.allow.json': JSON.stringify([{ ...entry, why: '' }]) }).status).toBe(1);
  });
});

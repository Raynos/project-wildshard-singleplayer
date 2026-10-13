// oxlint-disable-next-line import/no-nodejs-modules -- Exercise cache misses and corruption in fixture-owned files.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use isolated temporary fixtures.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { debugFlags, validateFlags } from '../lint/debug-flags.mjs';

it('keeps exact per-file facts across edits, additions, deletions and corrupt evidence', () => {
  const owned = mkdtempSync(join(tmpdir(), 'debug-facts-')), source = join(owned, 'src'), cache = join(owned, 'cache');
  const options = { today: '2026-10-13', max: 2, askExists: (id: string) => id === 'E435' };
  const row = (id: string): string => `const DEBUG_ROWS=[{id:'${id}',ask:'E435',reviewBy:'2026-12-01'}];`;
  try {
    mkdirSync(source); writeFileSync(join(source, 'a.ts'), row('one')); writeFileSync(join(source, 'b.ts'), 'export const value=1;');
    const expected = debugFlags(owned);
    expect(debugFlags(owned, cache)).toEqual(expected);
    expect(debugFlags(owned, cache)).toEqual(expected);
    expect(validateFlags(debugFlags(owned, cache), { ...options, max: 0 }).errors).toContain('debugRows: was 0, now 1; raise max and record the new ask in raisedBy');
    writeFileSync(join(source, 'a.ts'), row('two')); writeFileSync(join(source, 'c.ts'), row('added'));
    expect(debugFlags(owned, cache)).toEqual(debugFlags(owned));
    rmSync(join(source, 'c.ts')); expect(debugFlags(owned, cache)).toEqual(debugFlags(owned));
    for (const file of readdirSync(join(cache, 'debug-file-facts'))) writeFileSync(join(cache, 'debug-file-facts', file), '{');
    expect(debugFlags(owned, cache)).toEqual(debugFlags(owned));
    const receipt = join(cache, 'debug-file-facts', readdirSync(join(cache, 'debug-file-facts')).find(file => readFileSync(join(cache, 'debug-file-facts', file), 'utf8').startsWith('{"key"')) ?? 'missing');
    const damaged = JSON.parse(readFileSync(receipt, 'utf8')) as { payload: string };
    damaged.payload = ''; writeFileSync(receipt, JSON.stringify(damaged));
    expect(debugFlags(owned, cache)).toEqual(debugFlags(owned));
    writeFileSync(join(source, 'a.ts'), 'parsePlumbing({debug:[...opaque]});');
    expect(() => debugFlags(owned, cache)).toThrow('literal array');
    expect(() => debugFlags(owned, cache)).toThrow('literal array');
    writeFileSync(join(source, 'a.ts'), 'const = ;');
    expect(() => debugFlags(owned, cache)).toThrow('Cannot inventory');
  } finally { rmSync(owned, { recursive: true, force: true }); }
});


it('preserves explicit undefined fields in incomplete metadata exactly', () => {
  const root = mkdtempSync(join(tmpdir(), 'debug-facts-undefined-'));
  try {
    mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/row.ts'), "ctx.debugRow(make('incomplete'));" );
    const original = debugFlags(root);
    expect(Object.hasOwn(original[0] ?? {}, 'ask')).toBe(true);
    expect(debugFlags(root, join(root, 'cache'))).toEqual(original);
    expect(debugFlags(root, join(root, 'cache'))).toEqual(original);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

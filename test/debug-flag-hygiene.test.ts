// oxlint-disable-next-line import/no-nodejs-modules -- This Node fixture inventories authored files and writes the required overdue cache.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-side repository inventory resolves fixture paths.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { askExists, debugFlags, declaredDebugRows, validateFlags } from '../lint/debug-flags.mjs';
import { parseSync } from 'vite';

interface Ceiling { debugRows: { max: number; raisedBy: string[] } }
it('inventories literal declared rows through an aliased parser and rejects opaque spread rows', () => {
  const parse = (source: string): ReturnType<typeof parseSync>['program'] => parseSync('declarations.ts', source).program;
  expect(declaredDebugRows(parse("import { parsePlumbing as compile } from '@wildshard/sdk/plumbing'; const data=compile({debug:[{id:'owned',ask:'E435',reviewBy:'2026-12-01'}]});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('const data = parsePlumbing(input);'))).toEqual([]);
  expect(() => declaredDebugRows(parse('parsePlumbing({debug:[...opaque]});'))).toThrow('literal array');
  expect(declaredDebugRows(parse("import { directorVariant as choose } from '@wildshard/game/shardfile/directorClient'; choose(ctx,{id:'owned',ask:'E435',reviewBy:'2026-12-01'});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('directorVariant(ctx);'))).toEqual([]); // The shared literal lives in directorClient.DEBUG_ROWS.
  expect(declaredDebugRows(parse("import { runtimeVariantEnabled as variant } from '@wildshard/game/shard/runtimeVariant'; variant(ctx,{id:'trim',ask:'E435',reviewBy:'2026-12-01'});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('runtimeVariantEnabled(ctx, DEBUG_ROWS[0]);'))).toEqual([]);
});
describe('Debug flag ownership and review dates', () => {
  it('inventories all static/plugin rows, checks the ceiling, and lists overdue flags without failing', () => {
    const root = resolve('.'), ceiling = JSON.parse(readFileSync('lint/ratchet.json', 'utf8')) as Ceiling;
    const result = validateFlags(debugFlags(root), { today: new Date().toISOString().slice(0, 10), ...ceiling.debugRows, askExists: (id: string) => askExists(root, id) });
    mkdirSync('.cache', { recursive: true }); writeFileSync('.cache/debug-overdue.txt', `${result.overdue.join('\n')}${result.overdue.length > 0 ? '\n' : ''}`);
    if (result.overdue.length > 0) console.info(`Overdue Debug flags:\n${result.overdue.join('\n')}`);
    expect(result.errors).toEqual([]);
    if (existsSync('project/archive/2026-09-22-asks-table.md')) {
      const ids = JSON.parse(readFileSync('lint/ask-ids.json', 'utf8')) as string[];
      for (const id of ids) expect(askExists(root, id)).toBe(true);
      for (const row of debugFlags(root)) expect(ids).toContain(row.ask);
    }
  }, 120_000); // walks every Debug row's source and ask file: over 30 s on the CI coverage runner (assertions unchanged)
  it('rejects unknown owners and malformed dates; an overdue row passes and is listed', () => {
    const options = { today: '2026-10-01', max: 1, raisedBy: [], askExists: (id: string) => id === 'E357' };
    const row = { id: 'test', ask: 'E357', reviewBy: '2026-09-30' };
    expect(validateFlags([row], options)).toEqual({ errors: [], overdue: ['test | E357 | 2026-09-30'] });
    expect(validateFlags([{ ...row, ask: 'E999999' }], options).errors).toHaveLength(1);
    // E388: the owner's date stands; no invented horizon (the old 90-day cap had no source). A malformed date still fails.
    expect(validateFlags([{ ...row, reviewBy: '2027-12-31' }], options).errors).toEqual([]);
    expect(validateFlags([{ ...row, reviewBy: '2026-02-30' }], options).errors).toHaveLength(1);
    expect(validateFlags([row, row], options).errors).toHaveLength(1);
  });
});

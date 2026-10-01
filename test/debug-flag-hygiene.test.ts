// oxlint-disable-next-line import/no-nodejs-modules -- This Node fixture inventories authored files and writes the required overdue cache.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-side repository inventory resolves fixture paths.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { askExists, debugFlags, validateFlags } from '../lint/debug-flags.mjs';

interface Ceiling { debugRows: { max: number; raisedBy: string[] } }
describe('Debug flag ownership and review dates', () => {
  it('inventories all static/plugin rows, checks the ceiling, and lists overdue flags without failing', () => {
    const root = resolve('.'), ceiling = JSON.parse(readFileSync('lint/ratchet.json', 'utf8')) as Ceiling;
    const result = validateFlags(debugFlags(root), { today: new Date().toISOString().slice(0, 10), ...ceiling.debugRows, askExists: (id: string) => askExists(root, id) });
    mkdirSync('.cache', { recursive: true }); writeFileSync('.cache/debug-overdue.txt', `${result.overdue.join('\n')}${result.overdue.length > 0 ? '\n' : ''}`);
    if (result.overdue.length > 0) console.info(`Overdue Debug flags:\n${result.overdue.join('\n')}`);
    expect(result.errors).toEqual([]);
    if (existsSync('docs/tasks/ASKS.md')) {
      const ids = JSON.parse(readFileSync('lint/ask-ids.json', 'utf8')) as string[];
      for (const id of ids) expect(askExists(root, id)).toBe(true);
      for (const row of debugFlags(root)) expect(ids).toContain(row.ask);
    }
  }, 30_000); // walks every Debug row's source and ask file: over 5 s on a loaded machine (assertions unchanged)
  it('rejects unknown owners and distant dates; an overdue row passes and is listed', () => {
    const options = { today: '2026-10-01', max: 1, raisedBy: [], askExists: (id: string) => id === 'E357' };
    const row = { id: 'test', ask: 'E357', reviewBy: '2026-09-30' };
    expect(validateFlags([row], options)).toEqual({ errors: [], overdue: ['test | E357 | 2026-09-30'] });
    expect(validateFlags([{ ...row, ask: 'E999999' }], options).errors).toHaveLength(1);
    expect(validateFlags([{ ...row, reviewBy: '2026-12-31' }], options).errors).toHaveLength(1);
    expect(validateFlags([row, row], options).errors).toHaveLength(1);
  });
});

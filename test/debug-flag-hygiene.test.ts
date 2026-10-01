// oxlint-disable-next-line import/no-nodejs-modules -- This Node fixture inventories authored files and writes the required overdue cache.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  });
  it('rejects unknown owners and distant dates; an overdue row passes and is listed', () => {
    const options = { today: '2026-10-01', max: 1, raisedBy: [], askExists: (id: string) => id === 'E357' };
    const row = { id: 'test', ask: 'E357', reviewBy: '2026-09-30' };
    expect(validateFlags([row], options)).toEqual({ errors: [], overdue: ['test | E357 | 2026-09-30'] });
    expect(validateFlags([{ ...row, ask: 'E999999' }], options).errors).toHaveLength(1);
    expect(validateFlags([{ ...row, reviewBy: '2026-12-31' }], options).errors).toHaveLength(1);
    expect(validateFlags([row, row], options).errors).toHaveLength(1);
  });
});

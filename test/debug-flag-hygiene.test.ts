// oxlint-disable-next-line import/no-nodejs-modules -- This Node fixture inventories authored files and writes the required overdue cache.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-side repository inventory resolves fixture paths.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep syntax/order fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { askExists, debugFlags, declaredDebugRows, validateFlags } from '../lint/debug-flags.mjs';
import { legacyInventory, registeredLegacyFile } from '../scripts/legacy-shards.mjs';
import { parseSync } from 'vite';

interface Ceiling { debugRows: { max: number; raisedBy: string[] } }
// The source tree is immutable during this file's checks. Inventory it once;
// repeating the full AST walk adds coverage cost without testing another state.
let inventory: ReturnType<typeof debugFlags> | undefined;
function scannedFlags(): ReturnType<typeof debugFlags> {
  inventory ??= debugFlags(resolve('.'));
  return inventory;
}
it('inventories literal declared rows through an aliased parser and rejects opaque spread rows', () => {
  const parse = (source: string): ReturnType<typeof parseSync>['program'] => parseSync('declarations.ts', source).program;
  expect(declaredDebugRows(parse("import { parsePlumbing as compile } from '@wildshard/sdk/plumbing'; const data=compile({debug:[{id:'owned',ask:'E435',reviewBy:'2026-12-01'}]});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('const data = parsePlumbing(input);'))).toEqual([]);
  expect(() => declaredDebugRows(parse('parsePlumbing({debug:[...opaque]});'))).toThrow('literal array');
  expect(declaredDebugRows(parse("import { directorVariant as choose } from '@wildshard/game/shardfile/directorClient'; choose(ctx,{id:'owned',ask:'E435',reviewBy:'2026-12-01'});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('directorVariant(ctx);'))).toEqual([]); // The shared literal lives in directorClient.DEBUG_ROWS.
  expect(declaredDebugRows(parse("import { runtimeVariantEnabled as variant } from '@wildshard/game/shard/runtimeVariant'; variant(ctx,{id:'trim',ask:'E435',reviewBy:'2026-12-01'});"))).toHaveLength(1);
  expect(declaredDebugRows(parse('runtimeVariantEnabled(ctx, DEBUG_ROWS[0]);'))).toEqual([]);
  expect(declaredDebugRows(parse("import { registerGlobalDebugAction as install } from '@wildshard/engine/ui/authoredDebugRows'; install({id:'navigation',ask:'E357',reviewBy:'2026-12-01'});"))).toHaveLength(1);
});
describe('Debug flag ownership and review dates', () => {
  it('inventories all static/plugin rows, checks the ceiling, and lists overdue flags without failing', () => {
    const root = resolve('.'), ceiling = JSON.parse(readFileSync('lint/ratchet.json', 'utf8')) as Ceiling;
    const result = validateFlags(scannedFlags(), { today: new Date().toISOString().slice(0, 10), ...ceiling.debugRows, askExists: (id: string) => askExists(root, id) });
    mkdirSync('.cache', { recursive: true }); writeFileSync('.cache/debug-overdue.txt', `${result.overdue.join('\n')}${result.overdue.length > 0 ? '\n' : ''}`);
    if (result.overdue.length > 0) console.info(`Overdue Debug flags:\n${result.overdue.join('\n')}`);
    expect(result.errors).toEqual([]);
    if (existsSync('project/archive/2026-09-22-asks-table.md')) {
      const ids = JSON.parse(readFileSync('lint/ask-ids.json', 'utf8')) as string[];
      for (const id of ids) expect(askExists(root, id)).toBe(true);
      for (const row of scannedFlags()) expect(ids).toContain(row.ask);
    }
  }, 120_000); // walks every Debug row's source and ask file: over 30 s on the CI coverage runner (assertions unchanged)
  it('counts only comparisons while preserving Developer tool ownership and review checks', () => {
    const options = { today: '2026-10-01', max: 1, askExists: (id: string) => id === 'E435' };
    const row = { id: 'comparison', ask: 'E435', reviewBy: '2026-12-01' };
    const tool = { ...row, id: 'tool', purpose: 'developer' } as const;
    expect(validateFlags([row, tool], options).errors).toEqual([]);
    expect(validateFlags([row, { ...tool, ask: 'E999999' }], options).errors).toHaveLength(1);
    expect(validateFlags([{ ...tool, reviewBy: '2026-02-30' }], options).errors).toHaveLength(1);
    const frozen = legacyInventory(resolve('.'));
    const scanned = scannedFlags().filter(flag => flag.file === undefined || !registeredLegacyFile(frozen, relative(resolve('.'), flag.file))); 
    expect(scanned.filter(value => value.purpose === 'developer').map(value => value.id).sort()).toEqual([
      'ai.brains', 'budgetReadout', 'buildPacing', 'clearDownloads', 'fps', 'game.template', 'memorySaver', 'shardDirectors', 'storage', 'time', 'weather',
    ]);
  });
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

it('preserves whole-program aliases, definitions and declared-before-authored row order', () => {
  const root=mkdtempSync(resolve(tmpdir(), 'debug-syntax-order-'));
  try {
    mkdirSync(resolve(root, 'src'));
    const file=resolve(root, 'src/rows.ts');
    writeFileSync(file, `ctx.debugRow(late);
const DEBUG_ROWS=[{id:'table',ask:'E435',reviewBy:'2026-12-01'}];
compile({debug:[{id:'declared',ask:'E435',reviewBy:'2026-12-01'}]});
choose(ctx,{id:'director',ask:'E435',reviewBy:'2026-12-01'});
import{parsePlumbing as compile,directorVariant as choose}from'fixture';
const late={id:'late',ask:'E435',reviewBy:'2026-12-01'};
adapters.debugRow(opaque);
ctx.debugRow({id:'last',ask:'E435',reviewBy:'2026-12-01'});`);
    const rows=debugFlags(root);
    expect(rows.map(row => row.id)).toEqual(['declared','director','late','table','last']);
    expect(rows.every(row => row.file === file)).toBe(true);
    expect(debugFlags(root, resolve(root, 'cache'))).toEqual(rows);
    expect(debugFlags(root, resolve(root, 'cache'))).toEqual(rows);
  } finally {rmSync(root, {recursive:true, force:true});}
});

it('retains syntax, opaque-array and original first-error refusals', () => {
  const root=mkdtempSync(resolve(tmpdir(), 'debug-syntax-refusal-'));
  try {
    mkdirSync(resolve(root, 'src'));const file=resolve(root, 'src/rows.ts');
    writeFileSync(file, 'const broken = ;');
    expect(() => debugFlags(root)).toThrow('Cannot inventory Debug rows');
    writeFileSync(file, 'ctx.debugRow(opaque); parsePlumbing({debug:[...unknown]});');
    expect(() => debugFlags(root)).toThrow('Declared Debug rows must be a literal array');
    writeFileSync(file, 'const DEBUG_ROWS=[...unknown];');
    expect(() => debugFlags(root)).toThrow('DEBUG_ROWS must be a literal row array');
    writeFileSync(file, 'ctx.debugRow(opaque);');
    expect(() => debugFlags(root)).toThrow('Unresolvable Debug row');
  } finally {rmSync(root, {recursive:true, force:true});}
});

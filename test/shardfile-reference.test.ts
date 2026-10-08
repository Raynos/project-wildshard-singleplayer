// oxlint-disable-next-line import/no-nodejs-modules -- Temporary reference files are owned by this fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture paths.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ShardfileSchema } from '../src/game/shardfile/schema';
import { SCRIPT_EXPORTS, SCRIPT_IMPORTS } from '../src/engine/script/abi';
import { schemaInventory, abiInventory, renderReference } from '../scripts/docs/schema-reference.mjs';
import { shardfileReference } from '../scripts/docs/gen-shardfile-reference.mjs';

describe('schema-derived shardfile reference', () => {
  it('preserves optional, nullable, exact-optional and function defaults without calling them', () => {
    let called = 0;
    const rows = schemaInventory(v.strictObject({
      absent: v.exactOptional(v.string()), nullable: v.nullable(v.number(), 4),
      optional: v.optional(v.nullable(v.boolean()), false), factory: v.optional(v.number(), () => { called++; return 7; }),
    }));
    expect(rows.find(row => row.path === '$.absent')?.wrappers).toEqual([{ kind: 'exact_optional', default: 'undefined' }]);
    expect(rows.find(row => row.path === '$.nullable')?.wrappers).toEqual([{ kind: 'nullable', default: '4' }]);
    expect(rows.find(row => row.path === '$.optional')?.wrappers).toEqual([{ kind: 'optional', default: 'false' }, { kind: 'nullable', default: 'undefined' }]);
    expect(rows.find(row => row.path === '$.factory')?.wrappers[0]?.default).toContain('not executed'); expect(called).toBe(0);
  });
  it('keeps every union branch, variant discriminator, tuple slot and record key/value', () => {
    const rows = schemaInventory(v.strictObject({ choice: v.union([v.string(), v.number()]),
      variant: v.variant('kind', [v.strictObject({ kind: v.literal('a'), x: v.number() }), v.strictObject({ kind: v.literal('b'), y: v.string() })]),
      tuple: v.tuple([v.boolean(), v.array(v.string())]), map: v.record(v.pipe(v.string(), v.maxLength(8)), v.number()) }));
    expect(rows.map(row => row.path)).toEqual(['$', '$.choice', '$.choice<0>', '$.choice<1>', '$.map', '$.map{key}', '$.map{value}', '$.tuple', '$.tuple[0]', '$.tuple[1]', '$.tuple[1][]', '$.variant', '$.variant<0>', '$.variant<0>.kind', '$.variant<0>.x', '$.variant<1>', '$.variant<1>.kind', '$.variant<1>.y']);
    expect(rows.find(row => row.path === '$.variant')?.discriminator).toBe('kind');
    expect(rows.find(row => row.path === '$.variant<0>.kind')?.literal).toBe('"a"');
  });
  it('reports exact inclusive numeric and collection bounds from the same accepting schema', () => {
    const schema = v.strictObject({ value: v.pipe(v.number(), v.integer(), v.minValue(-2), v.maxValue(3)), list: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(2)) });
    const rows = schemaInventory(schema);
    expect(rows.find(row => row.path === '$.value')?.constraints).toEqual(['integer [function; not executed]', 'min_value -2', 'max_value 3']);
    expect(rows.find(row => row.path === '$.list')?.constraints).toEqual(['min_length 1', 'max_length 2']);
    for (const value of [-2, 3]) expect(v.safeParse(schema, { value, list: ['a'] }).success).toBe(true);
    for (const value of [-3, 4]) expect(v.safeParse(schema, { value, list: ['a'] }).success).toBe(false);
    for (const list of [[], ['a', 'b', 'c']]) expect(v.safeParse(schema, { value: 0, list }).success).toBe(false);
  });
  it('retains validators around an unknown-input pipeline without executing a check', () => {
    let called = 0;
    const schema = v.pipe(v.unknown(), v.rawCheck(() => { called++; }), v.strictObject({ value: v.pipe(v.string(), v.regex(/^a$/u)) }), v.check(() => { called++; return true; }, 'cross-field rule'));
    const rows = schemaInventory(schema);
    expect(rows[0]?.type).toBe('strict_object'); expect(rows[0]?.constraints).toContain('raw_check');
    expect(rows[0]?.constraints).toContain('check [function; not executed] "cross-field rule"');
    expect(rows[1]?.constraints).toEqual(['regex /^a$/u']); expect(called).toBe(0);
  });
  it('refuses unrecognized schema and action metadata rather than silently dropping fields', () => {
    expect(() => schemaInventory({ kind: 'schema', type: 'new_schema' })).toThrow('Unsupported schema');
    expect(() => schemaInventory({ kind: 'schema', type: 'number', pipe: [{ kind: 'validation', type: 'new_check' }] })).toThrow('Unsupported schema action');
    expect(() => schemaInventory(v.lazy(() => v.string()))).toThrow('Unsupported schema');
  });
  it('uses deterministic ordering and escapes table text while preserving required fields', () => {
    const a = v.strictObject({ z: v.optional(v.picklist(['a|b', 'c']), 'c'), a: v.number() });
    const b = v.strictObject({ a: v.number(), z: v.optional(v.picklist(['a|b', 'c']), 'c') });
    expect(schemaInventory(a)).toEqual(schemaInventory(b));
    const text = renderReference(schemaInventory(a), [], { version: 0 });
    expect(text).toContain('| $.a | number | required |'); expect(text).toContain('a&#124;b');
    expect(text).toContain('optional; default "c"');
  });
  it('documents all admitted ABI signatures with numeric types and rejects malformed tables', () => {
    const rows = abiInventory(SCRIPT_IMPORTS, SCRIPT_EXPORTS);
    expect(rows).toHaveLength(Object.keys(SCRIPT_IMPORTS).length + Object.keys(SCRIPT_EXPORTS).length);
    expect(rows.find(row => row.name === 'query')).toEqual({ kind: 'import', name: 'query', parameters: ['i32', 'i32', 'i32'], result: 'i32' });
    expect(rows.find(row => row.name === '__start')?.result).toBe('void');
    expect(() => abiInventory({ bad: [0, 0x7f] }, {})).toThrow('Invalid ABI');
    expect(() => abiInventory({}, { bad: [99] })).toThrow('Invalid ABI');
  });
  it('covers real nested fields after preflight and every top-level schema entry', () => {
    const rows = schemaInventory(ShardfileSchema), paths = new Set(rows.map(row => row.path));
    for (const path of ['$.identity.seed', '$.entryways[].width', '$.props.colliders[].shapes[]<0>.rot.w', '$.runtime.cost', '$.sim.bindings[]', '$.look.familyLooks.toon']) expect(paths.has(path), path).toBe(true);
    expect(rows.find(row => row.path === '$.entryways[].width')?.literal).toBe('8');
    expect(rows.filter(row => /^\$\.[a-zA-Z]+$/u.test(row.path)).length).toBeGreaterThan(30);
  });
  it('generates the same real schema reference in plain Node twice without an app', () => {
    const first = shardfileReference(resolve('.')), second = shardfileReference(resolve('.'));
    expect(first).toBe(second); expect(first).toContain('$.identity.seed'); expect(first).toContain('| export | on_tick | — | void |');
    const dir = mkdtempSync(resolve(tmpdir(), 'sf45-reference-'));
    try {
      mkdirSync(resolve(dir, 'docs/api'), { recursive: true }); writeFileSync(resolve(dir, 'docs/api/SHARDFILE.md'), first);
      expect(readFileSync(resolve(dir, 'docs/api/SHARDFILE.md'), 'utf8')).toBe(first);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

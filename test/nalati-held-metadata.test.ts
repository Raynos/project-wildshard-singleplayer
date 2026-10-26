import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiHeldMetadata, nalatiHeldSource } from '../src/shards/nalati-grasslands/generators/heldMetadata';
import { originalSpeciesJson } from './fixtures/nalati-original-species';
import pins from './fixtures/nalati-held-files.json' with { type: 'json' };

const source = v.parse(v.object({
  program: ReturnProgramSchema,
  compiled: v.object({ source: v.string(), bytes: v.number(), hash: v.string() }),
}), originalSpeciesJson('species.json'));
const serialize = (rows: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(rows, null, 2)}\n`);

test('explicit held program inputs reproduce both complete original documents', () => {
  const rows = nalatiHeldMetadata(source.program, source.compiled);
  expect(pins).toHaveLength(2);
  for (const [index, value] of [rows.held, rows.stealth].entries()) {
    const pin = pins[index];
    if (pin === undefined) throw new Error('Missing original held file pin');
    const bytes = serialize(value);
    expect(bytes.length, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
});

test('each composition and program signal owns detached source rows', () => {
  const original = JSON.stringify(source), first = nalatiHeldMetadata(source.program, source.compiled);
  first.held.program.bytes = 'changed';
  first.held.programs.polearm.bytes = 'changed polearm';
  first.held.powers.crescentRange = 0;
  expect(JSON.stringify(source)).toBe(original);
  expect(first.stealth.program.bytes).toBe(source.program.bytes);
  expect(first.held.programs.blade.bytes).toBe(source.program.bytes);
  expect(first.held.programs.power.bytes).toBe(source.program.bytes);
  const rebuilt = nalatiHeldMetadata(source.program, source.compiled);
  expect(rebuilt.held.powers.crescentRange).toBeGreaterThan(0);
  expect(rebuilt.held.program.bytes).toBe(source.program.bytes);
});

test('native source admission retains complete metadata and refuses malformed executable charges', () => {
  const rows = nalatiHeldSource(originalSpeciesJson('species.json'));
  const before = nalatiHeldMetadata(source.program, source.compiled);
  expect(rows).toStrictEqual(before);
  for (const bytes of [0, -1, Number.NaN, Infinity, 0.5])
    expect(() => nalatiHeldSource({ ...source, compiled: { ...source.compiled, bytes } })).toThrow('Invalid source-owned held metadata');
  expect(() => nalatiHeldSource({ ...source, compiled: { ...source.compiled, hash: 'not a full hash' } })).toThrow('Invalid source-owned held metadata');
  expect(() => nalatiHeldSource({ ...source, program: { ...source.program, script: null } })).toThrow('Invalid source-owned held metadata');
});

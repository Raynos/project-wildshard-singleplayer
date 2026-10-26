// oxlint-disable-next-line import/no-nodejs-modules -- Read the complete original species metadata as an independent header fixture.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { nalatiProductRows } from '../src/shards/nalati-grasslands/generators/product';
import { hashImmutableBytes } from '../src/sdk/immutable';
import pin from './fixtures/nalati-species-product-header.json' with { type: 'json' };

const original = v.parse(v.object({
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string() }),
  witnessBytes: v.number(),
}), JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
const product = nalatiProductRows(original);
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('explicit species costs retain the entire pre-factory product header and default contract', () => {
  const made = nalatiProductRows(original), bytes = encode(made);
  expect(bytes.length).toBe(pin.bytes);
  expect(hashImmutableBytes(bytes)).toBe(pin.sha256);
  expect(made).toStrictEqual(product);
});

test('witness bytes and species pages retain their separate original budget charges', () => {
  const witness = nalatiProductRows({ ...original, witnessBytes: original.witnessBytes + 7 });
  expect(witness.serverBudget.memory - product.serverBudget.memory).toBe(7);
  expect(witness.budgets.sim.resident - product.budgets.sim.resident).toBe(7);
  expect(witness.budgets.sim.compressed - product.budgets.sim.compressed).toBe(7);
  const pages = nalatiProductRows({ ...original, program: { ...original.program, script: { ...original.program.script, pages: original.program.script.pages + 1 } } });
  expect(pages.serverBudget.memory - product.serverBudget.memory).toBe(2 * 65536);
  expect(pages.budgets.sim.resident - product.budgets.sim.resident).toBe(2 * 65536);
  expect(pages.budgets.sim.compressed).toBe(product.budgets.sim.compressed);
  expect(pages.clientChannels).toStrictEqual(product.clientChannels);
  expect(pages.files).toStrictEqual(product.files);
});

test('original module deduplication prevents charging an existing module payload twice', () => {
  const sameModule = nalatiProductRows({ ...original, program: { ...original.program, bytes: btoa('extra') } });
  expect(sameModule).toStrictEqual(product);
  const distinct = nalatiProductRows({ ...original, program: { ...original.program, script: { ...original.program.script, module: 'blobs/wasm/distinct.wasm' }, bytes: btoa('extra') } });
  expect(distinct.budgets.sim.compressed - product.budgets.sim.compressed).toBe(5);
  expect(distinct.budgets.sim.resident - product.budgets.sim.resident).toBe(5);
  expect(distinct.serverBudget.memory - product.serverBudget.memory).toBe(5);
});

test('separate headers own their admitted file rows and budget storage', () => {
  const made = nalatiProductRows(original), first = made.files[0];
  if (first === undefined) throw new Error('Missing original header asset');
  first.decoded = 0;
  made.budgets.sim.resident = 0;
  const again = encode(nalatiProductRows(original));
  expect(hashImmutableBytes(again)).toBe(pin.sha256);
  expect(hashImmutableBytes(encode(product))).toBe(pin.sha256);
});

test('invalid explicit species page and witness costs refuse before composition', () => {
  for (const witnessBytes of [-1, Number.NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() => nalatiProductRows({ ...original, witnessBytes })).toThrow('Invalid species program costs');
  for (const pages of [0, -1, Number.NaN, Infinity, 0.5])
    expect(() => nalatiProductRows({ ...original, program: { ...original.program, script: { ...original.program.script, pages } } })).toThrow('Invalid species program costs');
});

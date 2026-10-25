// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';
import { HeldEquipmentSchema, type HeldEquipmentInput, type HeldEquipmentRows } from './heldEquipment';
import * as v from 'valibot';

test('held equipment declarations bound metadata and retain explicit authored and parsed data', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/heldEquipment.ts', 'utf8'), {
    fileName: 'heldEquipment.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(37_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferInput<typeof Channels>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof Channels>');
});

test('the existing firearm view path retains exact input and output contracts', () => {
  const schema = HeldEquipmentSchema.entries.firearm.entries.rows.entries.view;
  const contract: v.GenericSchema<HeldEquipmentInput['firearm']['rows']['view'], HeldEquipmentRows['firearm']['rows']['view']> = schema;
  expect(contract).toBe(schema);
  expect(() => v.parse(contract, {})).toThrow();
});

// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { QuestStepRowsSchema } from './questSteps';

test('quest declarations retain imported contracts and bound validator metadata', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/questSteps.ts', 'utf8'), {
    fileName: 'questSteps.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(18_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).not.toContain('VariantSchema');
  expect(emitted.outputText).toContain('v.InferInput<typeof ObservationRefSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof ObservationRefSchema>');
});

test('the existing held-arm guard reader retains its defining bounded item schema', () => {
  const schema = QuestStepRowsSchema.entries.guards.item;
  const row = { id: 'guard', actor: 'actor', message: 'Wait' };
  expect(v.parse(schema, row)).toEqual(row);
  expect(() => v.parse(schema, { ...row, arbitrary: true })).toThrow();
  expect(() => v.parse(schema, { ...row, absentUnless: '' })).toThrow();
});

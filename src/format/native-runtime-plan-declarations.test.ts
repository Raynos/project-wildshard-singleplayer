// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('native plan declarations retain normalized owner inputs and defining recipe contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/nativeRuntimePlan.ts', 'utf8'), {
    fileName: 'nativeRuntimePlan.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(7_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.GenericSchema<unknown, NativeRuntimePlanData>');
  expect(emitted.outputText).toContain('ownerInputs: string[]');
  expect(emitted.outputText).toContain('v.InferOutput<typeof BossOwnerRowSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<(typeof StateSchema.pipe)[0]>');
});

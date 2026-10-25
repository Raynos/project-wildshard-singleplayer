// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual public declaration surface without products.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('client plan declarations emit in isolation and reference defining schema contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/clientPlan.ts', 'utf8'), {
    fileName: 'clientPlan.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(24_000);
  expect(emitted.outputText).not.toContain('VariantSchema');
  expect(emitted.outputText).not.toContain('StrictObjectSchema');
  expect(emitted.outputText).toContain('v.GenericSchema<ClientFeatureInput, ClientFeatureRow>');
  expect(emitted.outputText).toContain('v.InferInput<typeof WorldAssemblySchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof WorldAssemblySchema>');
});

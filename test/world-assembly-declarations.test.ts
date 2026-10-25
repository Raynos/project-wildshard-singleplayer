// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('world assembly declarations preserve data contracts without validator metadata', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/worldAssembly.ts', 'utf8'), {
    fileName: 'worldAssembly.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(13_000);
  expect(emitted.outputText).not.toContain('VariantSchema');
  expect(emitted.outputText).not.toContain('StrictObjectSchema');
  expect(emitted.outputText).toContain('v.GenericSchema<unknown, WorldAssemblyRows>');
  expect(emitted.outputText).toContain('v.InferInput<typeof AmbientFlockSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof AmbientFlockSchema>');
  expect(emitted.outputText).toContain("mode: 'room'");
});

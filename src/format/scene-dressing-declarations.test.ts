// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the defining declaration source without build products.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('dressing declarations isolate schema metadata while retaining file and catalogue contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/sceneDressing.ts', 'utf8'), {
    fileName: 'sceneDressing.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(16_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).not.toContain('StrictObjectSchema');
  expect(emitted.outputText).toContain('v.InferInput<typeof BinaryFileSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof BinaryFileSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof SpecimenCatalogueSchema>');
});

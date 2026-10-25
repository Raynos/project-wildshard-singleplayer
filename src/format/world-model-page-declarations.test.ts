// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test.each(['worldSceneModels', 'questPageComposition'])('%s declarations isolate validators from public data contracts', name => {
  const emitted = ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`, 'utf8'), {
    fileName: `${name}.ts`, reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(9_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).not.toContain('StrictObjectSchema');
  if (name === 'worldSceneModels') expect(emitted.outputText).toContain('models: WorldSceneModelRows[]');
  else {
    expect(emitted.outputText).toContain('v.GenericSchema<unknown, QuestPageRows>');
    expect(emitted.outputText).toContain('v.InferOutput<typeof QuestContinuationSchema>');
  }
});

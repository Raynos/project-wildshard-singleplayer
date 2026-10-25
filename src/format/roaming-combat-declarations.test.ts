// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';
import type * as v from 'valibot';
import { RoamingCombatSchema, type RoamingCombatRows } from './roamingCombat';

test('roaming combat declarations retain defining contracts without inlining their validators', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/roamingCombat.ts', 'utf8'), {
    fileName: 'roamingCombat.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(3_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferOutput<typeof BossCombatSessionSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof RoamingBossProjectionSchema>');
  const contract: v.GenericSchema<unknown, RoamingCombatRows> = RoamingCombatSchema;
  expect(contract).toBe(RoamingCombatSchema);
});

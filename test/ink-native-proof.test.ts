import { expect, test } from 'vitest';
import { nativeProof } from './proof/ink-cel-valley/native';

for (const mode of ['boot', 'headless', 'replay', 'ledger'] as const) test(`Ink prepared product retains its native ${mode} proof`, () => {
  expect(nativeProof(mode)).toContain(`"${mode}":`);
});

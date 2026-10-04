import { expect, it } from 'vitest';
import { nativeProof } from './native';

it('replays the full 600-tick Big Blob suffix from script memory, globals, quest and ledger dedupe', () => {
  const output = nativeProof('replay'); expect(output).toContain('"ticks":600'); expect(output).toContain('"questComplete":true'); expect(output).toContain('"ledgerDedupe":1');
});

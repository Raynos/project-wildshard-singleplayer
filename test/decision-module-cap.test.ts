import { expect, test } from 'vitest';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { CONTRACT_PROGRAM_SCRIPT } from '../src/shards/pine-hollow/generators/contractProgram';

/** `count` rows of the same declared guest, each its own id and module. */
const rows = (count: number) => Array.from({ length: count }, (_, i) =>
  ({ ...CONTRACT_PROGRAM_SCRIPT, id: `guest.${String(i)}`, module: `blobs/wasm/${i.toString(16).padStart(64, '0')}.wasm` }));

// G20a / G769: Pine's contract guest is a ninth admitted decision module.
test('a product admits nine distinct decision modules and refuses a tenth', () => {
  expect(parseDecisionScripts(rows(9))).toHaveLength(9);
  expect(() => parseDecisionScripts(rows(10))).toThrow('at most nine decision modules');
});

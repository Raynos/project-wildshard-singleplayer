import { expect, it } from 'vitest';
import { WIRE_CELL, CLIENT_SCRIPT_LIMITS as wire } from '@wildshard/format/wireLimits';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { CLIENT_SCRIPT_LIMITS as native } from '@wildshard/engine/script/client';

it('keeps the format wire bounds equal to independent engine cell and presentation capacities', () => {
  expect(WIRE_CELL).toEqual({ half: CHUNK_HALF, above: CELL_ABOVE, below: CELL_BELOW, entryWidth: ENTRY_WIDTH });
  expect(wire).toEqual(native);
});

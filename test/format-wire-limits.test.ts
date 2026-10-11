import { expect, it } from 'vitest';
import { WIRE_CELL, CLIENT_SCRIPT_LIMITS as wire, RUNTIME_RESIDENT_FACTOR, WEAPON_HOOK_PHASES as phases } from '@wildshard/format/wireLimits';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF, ENTRY_WIDTH, CONTENT_CAPS } from '@wildshard/engine/core/config';
import { WEAPON_HOOK_PHASES as nativePhases } from '@wildshard/game/plugin/weaponHooks';
import { CLIENT_SCRIPT_LIMITS as native } from '@wildshard/engine/script/client';

it('keeps the format wire bounds equal to independent engine cell and presentation capacities', () => {
  expect(WIRE_CELL).toEqual({ half: CHUNK_HALF, above: CELL_ABOVE, below: CELL_BELOW, entryWidth: ENTRY_WIDTH });
  expect(wire).toEqual(native);
});

it('keeps measured-runtime calibration and admitted weapon phases equal to their native owners', () => {
  expect(RUNTIME_RESIDENT_FACTOR).toBe(CONTENT_CAPS.residentFactor);
  expect(phases).toEqual(nativePhases);
});

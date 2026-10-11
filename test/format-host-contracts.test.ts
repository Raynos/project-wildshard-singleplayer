import { expect, it } from 'vitest';
import { SCRIPT_LIMITS } from '@wildshard/format/scriptLimits';
import { SCRIPT_LIMITS as hostLimits } from '@wildshard/engine/script/host';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { parseBakedTerrain as hostParser } from '@wildshard/engine/world/BakedTerrain';
import { WAVES } from '@wildshard/format/waterWaves';
import { WAVES as hostWaves } from '@wildshard/engine/world/waves';

it('retains identity of the native limits, terrain parser and swell rows', () => {
  expect(hostLimits).toBe(SCRIPT_LIMITS);
  expect(hostParser).toBe(parseBakedTerrain);
  expect(hostWaves).toBe(WAVES);
});

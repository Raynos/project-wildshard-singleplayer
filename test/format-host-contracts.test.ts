import { portalLinkEntries as frozenPortals } from '@wildshard/game/shardfile/portalLink';
import { portalLinkEntries } from '@wildshard/format/portalLinkAssets';
import { socketLiftEntries as frozenLifts } from '@wildshard/game/shardfile/socketLift';
import { socketLiftEntries } from '@wildshard/format/socketLiftAssets';
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

it('keeps frozen portal and lift entry consumers bound to the defining format functions', () => {
  expect(frozenPortals).toBe(portalLinkEntries);
  expect(frozenLifts).toBe(socketLiftEntries);
});

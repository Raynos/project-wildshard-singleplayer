import { parse as parseSpeciesAdmission } from 'valibot';
import { SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import perchRows from '../src/shards/driftwood-isle/data/mixedPopulation.json' with { type: 'json' };
import { Scope } from '../src/engine/app/scope';
import { ENGINE_CONTENT_STRINGS } from '../src/game/engineStrings';
import { installEngineStrings } from '../src/engine/strings';
/**
 * Test environment: plain node plus the two browser globals the game's pure modules touch at import time —
 * `localStorage` (Settings / Inventory / Progress / boot timings persist there) and `location` (the chunk registry
 * and the quality tier read `?chunk=` / `?tier=`). A fresh, empty storage for every test; a test that needs storage
 * to throw (iOS private mode) spies on it (`restoreMocks` in vitest.config.ts undoes the spy).
 */
import { beforeEach, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- the setup reads Nalati's committed bodies bake (species/bodies.ts)
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- the committed bake is a zlib stream the page inflates
import { inflateSync } from 'node:zlib';

export class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

installEngineStrings(ENGINE_CONTENT_STRINGS);
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('location', new URL('http://localhost:5173/'));

// the app identity and asset tables first: save keys, the probe's handles and the boot read them (E405 E414 / E415)
await import('../src/identity');
await import('../src/shardList');
const { registerAchievements } = await import('../src/game/achievements');
const { PINE_FEATS } = await import('../src/shards/pine-hollow/generators/questInventory');
const { DRIFTWOOD_ITEMS, DRIFTWOOD_FEATS } = await import('../src/shards/driftwood-isle/generators/questInventory');
registerAchievements('pine-hollow', PINE_FEATS);
registerAchievements('driftwood-isle', DRIFTWOOD_FEATS);

// The composition root owns shared species; the engine has no upward kit import.
(await import('../src/engine/world/registry')).installWorldRegistry(); // the session installs it in the game
const { registerSpecies } = await import('../src/engine/entities/species/registry');
const { speciesWithLook } = await import('../src/engine/entities/species/look');
const { installScore } = await import('../src/engine/audio/score/score');
const { WILDSHARD_SCORE } = await import('../src/game/audio/theme');
installScore(WILDSHARD_SCORE);
const { installKitSpecies } = await import('../src/game/systems/species/install');
const { installKitIcons } = await import('../src/game/icons');
const { installPickupCatalogue } = await import('../src/game/models/specimenCatalogue');
const { default: PICKUP_CATALOGUE } = await import('../src/game/data/pickupCatalogue.json');
const { installKitProps } = await import('../src/game/models/interact');
installKitSpecies();
installKitIcons();
installPickupCatalogue(PICKUP_CATALOGUE);
installKitProps();
const { readLootTables, registerLootTable } = await import('../src/game/loot/tables');
const { default: loot } = await import('../src/shards/driftwood-isle/data/loot.generated.json');
for (const row of readLootTables(loot.economy.tables)) registerLootTable(row);
const { DRIFTWOOD_LOOKS } = await import('./fake/driftwoodLooks');
const { DRIFTWOOD_SPECIES } = await import('./fake/driftwoodSpecies');
const { MONKEY_CLIPS } = await import('../src/shards/driftwood-isle/generators/monkeyClips');
const { PerchBodyBinding } = await import('@wildshard/game/population/perchBody');
const { RETURN_PROGRAM } = await import('../src/shards/driftwood-isle/generators/returnProgram');
const monkeyAnimate = new PerchBodyBinding({ clips: MONKEY_CLIPS, program: RETURN_PROGRAM, perch: perchRows.perch }, new Scope('fixture.monkey')).animate;
for (let i = 0; i < DRIFTWOOD_SPECIES.length; i++) {
  const row = DRIFTWOOD_SPECIES[i], look = DRIFTWOOD_LOOKS[i];
  if (row !== undefined && look !== undefined) registerSpecies(speciesWithLook(row, look.kind === 'monkey' ? { ...look, animate: monkeyAnimate } : look));
}
const { prepareNalatiSpecies,prepareGoldenKing } = await import('../src/shards/nalati-grasslands/species/presentation');
const { installNalatiSpeciesForTests } = await import('../src/shards/nalati-grasslands/species/catalogue');
prepareGoldenKing((await import('../src/shards/nalati-grasslands/data/goldenKingPose.generated.json')).default.programs);
const speciesPresentation = (await import('../src/shards/nalati-grasslands/data/species.generated.json')).default;
const { HullLookBook: NalatiHullBook } = await import('../src/game/looks/speciesBook');
await prepareNalatiSpecies(parseSpeciesAdmission(SpeciesPresentationSchema,speciesPresentation.presentation), new NalatiHullBook(speciesPresentation.hullBook), speciesPresentation.looks, Uint8Array.from(speciesPresentation.crackBytes));
installNalatiSpeciesForTests();
// Production uses the packed-body host; preload its exact binary through its normal fetch port.
const { preloadNalatiBodies } = await import('../src/shards/nalati-grasslands/species/presentation');
const speciesBodies = (await import('../src/shards/nalati-grasslands/data/species.generated.json')).default.packedBodies;
const bodyFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
  if (input !== speciesBodies.file) throw new Error('Unexpected packed-body preload');
  return Promise.resolve(new Response(new Uint8Array(readFileSync(`public${speciesBodies.file}`))));
});
try { await preloadNalatiBodies(); } finally { bodyFetch.mockRestore(); }
const { unshuffleLanes: unshuffleBodyLanes } = await import('../src/engine/core/deflate');
// and its camps' and bridge's places bake (world/placeBake.ts)
const { loadShapes } = await import('../src/shards/nalati-grasslands/models/shapes');
await loadShapes(new Map([['/assets/nalati/baked/places.bin', unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/places.bin'))))]]));
// Legacy fixtures include Pine's spawn-only thrall, without activating a rendered level.
const { PINE_BOAR } = await import('../src/shards/pine-hollow/generators/speciesRows');
const { HullLookBook } = await import('../src/game/looks/speciesBook');
const { SPECIES_LOOKS } = await import('../src/shards/pine-hollow/generators/nativeView');
const pineBook = new HullLookBook(SPECIES_LOOKS);
const { THRALL_CLIPS } = await import('../src/shards/pine-hollow/generators/thrallClips');
const { numericCreaturePose } = await import('../src/game/plugin/channelPrograms');
registerSpecies(speciesWithLook(PINE_BOAR, { ...pineBook.look('boar'), postPose: numericCreaturePose(THRALL_CLIPS) }));
// and its elk thrall (E405: Pine's, derived from the kit's elk)
const { pineElk } = await import('../src/shards/pine-hollow/generators/speciesRows');
registerSpecies(speciesWithLook(pineElk(), pineBook.look('elk')));
// Pure inventory fixtures explicitly install the authored item catalogs.
const { registerItemRow } = await import('../src/game/bag/itemCatalog');
const { STARTER_BAG_ITEMS } = await import('../src/game/bag/starter.generated');
const { PINE_BAG_ITEMS: PINE_ITEMS } = await import('../src/shards/pine-hollow/generators/questInventory');
for (const row of [...STARTER_BAG_ITEMS, ...PINE_ITEMS, ...DRIFTWOOD_ITEMS]) registerItemRow(row);

beforeEach(() => { localStorage.clear(); });

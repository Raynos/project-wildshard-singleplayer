import { originalSpeciesJson, originalSpeciesFile } from './fixtures/nalati-original-species';
import * as v from 'valibot';
import { SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import { HullLookBookSchema } from '@wildshard/format/speciesLooks';
import perchRows from '../src/shards/driftwood-isle/data/mixedPopulation.json' with { type: 'json' };
import { Scope } from '../src/engine/app/scope';
import { ENGINE_CONTENT_STRINGS } from '../src/game/engineStrings';
import { installEngineStrings } from '../src/engine/strings';
import { prepareNativeScalarBlocks } from '../scripts/bake/nativeWorld.mjs';
import { nalatiGeographySources } from '../src/shards/nalati-grasslands/generators/geographySource';
/**
 * Test environment: plain node plus the two browser globals the game's pure modules touch at import time —
 * `localStorage` (Settings / Inventory / Progress / boot timings persist there) and `location` (the chunk registry
 * and the quality tier read `?chunk=` / `?tier=`). A fresh, empty storage for every test; a test that needs storage
 * to throw (iOS private mode) spies on it (`restoreMocks` in vitest.config.ts undoes the spy).
 */
import { beforeEach, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The shared pickup fixture reads its explicitly declared public assets.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the exact pinned original lane-shuffled stream.
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
// Node tests enter below the browser's selected-entry transport. Install the
// same generated values explicitly before any tested gameplay module reads them.
const [{ installAssetTables }, { PUBLIC_BYTES }, { ASSET_VERSIONS }, audioTables, { PACKS }] = await Promise.all([
  import('../src/engine/boot/tables'), import('../src/game/boot/bytes.generated'),
  import('../src/game/boot/versions.generated'), import('../src/game/boot/audio.generated'), import('../src/game/boot/packs.generated'),
]);
installAssetTables({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: audioTables.MUSIC_MANIFESTS, sfx: audioTables.SFX_MANIFESTS, packs: PACKS });
await import('../src/shardList');
const {shards:scalarDefinitions}=await import('../src/game/shard/list');
for (const definition of scalarDefinitions()) {
  const intake = definition.scalarBlocks;
  if (definition.slug === 'nalati-grasslands' && intake !== undefined && !intake.prepared) {
    const sources = nalatiGeographySources();
    intake.prepare(new Map(intake.files.map(file => {
      const bytes = sources.get(file);
      if (bytes === undefined) throw new Error(`Missing owned Nalati scalar source: ${file}`);
      return [file, bytes];
    })));
  }
  prepareNativeScalarBlocks(definition, process.cwd());
}
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
const { installPickupCatalogue, preparePickupCatalogue } = await import('../src/game/models/specimenCatalogue');
const { default: PICKUP_CATALOGUE } = await import('../src/game/data/pickupCatalogue.json');
const { installKitProps } = await import('../src/game/models/interact');
installKitSpecies();
installKitIcons();
installPickupCatalogue(PICKUP_CATALOGUE, await preparePickupCatalogue({ file: name => Promise.resolve(new Uint8Array(readFileSync(`public${name}`))) }, PICKUP_CATALOGUE));
installKitProps();
const { readLootTables, registerLootTable } = await import('../src/game/loot/tables');
const { DRIFTWOOD_LOOT: loot } = await import('../src/shards/driftwood-isle/generators/loot');
for (const row of readLootTables(loot.economy.tables)) registerLootTable(row);
const { DRIFTWOOD_LOOKS } = await import('./fake/driftwoodLooks');
const { DRIFTWOOD_SPECIES } = await import('./fake/driftwoodSpecies');
const { MONKEY_CLIPS } = await import('../src/shards/driftwood-isle/generators/monkeyClips');
const { PerchBodyBinding } = await import('@wildshard/game/population/perchBody');
const { RETURN_PROGRAM } = await import('./fixtures/driftwood-guest-programs');
const {lendDriftwoodReturns}=await import('./fixtures/driftwood-return-modules');
const monkeyAnimate = new PerchBodyBinding({ clips: MONKEY_CLIPS, program: RETURN_PROGRAM, perch: perchRows.perch }, lendDriftwoodReturns(new Scope('fixture.monkey'))).animate;
for (let i = 0; i < DRIFTWOOD_SPECIES.length; i++) {
  const row = DRIFTWOOD_SPECIES[i], look = DRIFTWOOD_LOOKS[i];
  if (row !== undefined && look !== undefined) registerSpecies(speciesWithLook(row, look.kind === 'monkey' ? { ...look, animate: monkeyAnimate } : look));
}
const { nalatiSpeciesCatalogue, prepareNalatiSpecies } = await import('./fake/nalatiSpecies');
// Admit the complete original envelope; its looks retain their defining
// packed-look admission inside productSpeciesCatalogue.
const speciesPresentation = v.parse(v.object({
  hullBook: HullLookBookSchema, presentation: SpeciesPresentationSchema, looks: v.unknown(),
  crackBytes: v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255))),
  packedBodies: v.object({ file: v.string() }),
}), originalSpeciesJson('species.json'));
const { productSpeciesCatalogue } = await import('../src/game/looks/speciesBook');
prepareNalatiSpecies(productSpeciesCatalogue({section:()=>speciesPresentation.hullBook,
  file: name => name === 'actors/balbal-cracks.bin' ? Promise.resolve(Uint8Array.from(speciesPresentation.crackBytes)) : Promise.reject(new Error(`Unexpected product file ${name}`)) },speciesPresentation.presentation,speciesPresentation.looks));
for(const row of nalatiSpeciesCatalogue().rows){
  const look=nalatiSpeciesCatalogue().looks.find(candidate=>candidate.kind===row.kind);
  if(look===undefined)throw new Error('Missing species look');
  registerSpecies(speciesWithLook(row,look));
}
// Production uses the packed-body host; preload its exact binary through its normal fetch port.
const speciesBodies = speciesPresentation.packedBodies;
const bodyFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
  if (input !== speciesBodies.file) throw new Error('Unexpected packed-body preload');
  return Promise.resolve(new Response(originalSpeciesFile('bodies.bin')));
});
try { await nalatiSpeciesCatalogue().preload(); } finally { bodyFetch.mockRestore(); }
const { unshuffleLanes: unshuffleBodyLanes } = await import('../src/engine/core/deflate');
// and its camps' and bridge's places bake (world/placeBake.ts)
const { SHAPES, SHAPE_BYTES } = await import('./fixtures/nalatiShapes');
const { originalPlaceBinary } = await import('./fixtures/nalati-original-place-binary');
if (!SHAPES.ready) await SHAPES.load(new Map([...SHAPE_BYTES, ['/assets/nalati/baked/places.bin', unshuffleBodyLanes(new Uint8Array(inflateSync(await originalPlaceBinary())))]]));
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
const { default: starterItems } = await import('../src/game/bag/starterItems.json');
const STARTER_BAG_ITEMS = v.parse(v.array(v.object({ id: v.string(), label: v.string(), icon: v.picklist(['meat', 'hide', 'tusk', 'antlers']), travels: v.boolean() })), starterItems);
const { PINE_BAG_ITEMS: PINE_ITEMS } = await import('../src/shards/pine-hollow/generators/questInventory');
for (const row of [...STARTER_BAG_ITEMS, ...PINE_ITEMS, ...DRIFTWOOD_ITEMS]) registerItemRow(row);

beforeEach(() => { localStorage.clear(); });

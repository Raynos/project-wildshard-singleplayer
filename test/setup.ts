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
const { PINE_FEATS } = await import('../src/shards/pine-hollow/feats');
const { DRIFTWOOD_ITEMS, DRIFTWOOD_FEATS } = await import('../src/shards/driftwood-isle/quest/rows');
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
const { installKitPickups } = await import('../src/game/models/pickups');
const { installKitProps } = await import('../src/game/models/interact');
installKitSpecies();
installKitIcons();
installKitPickups();
installKitProps();
const { installDriftwoodSpecies } = await import('../src/shards/driftwood-isle/species/install');
installDriftwoodSpecies();
const { installNalatiSpeciesForTests } = await import('../src/shards/nalati-grasslands/species/rows');
installNalatiSpeciesForTests();
// Nalati's species bodies are an offline bake the page fetches: tests read the committed file (species/bodies.ts)
const { provideNalatiBodies, unshuffleBodyLanes } = await import('../src/shards/nalati-grasslands/species/bodies');
provideNalatiBodies(() => unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/bodies.bin')))));
// Legacy fixtures include Pine's spawn-only thrall, without activating a rendered level.
const { PINE_BOAR } = await import('../src/shards/pine-hollow/species/rows');
const { PINE_BOAR_LOOK } = await import('../src/shards/pine-hollow/species/looks');
registerSpecies(speciesWithLook(PINE_BOAR, PINE_BOAR_LOOK));
// and its elk thrall (E405: Pine's, derived from the kit's elk)
const { pineElk } = await import('../src/shards/pine-hollow/species/rows');
const { pineElkLook } = await import('../src/shards/pine-hollow/species/looks');
registerSpecies(speciesWithLook(pineElk(), pineElkLook()));
// Pure inventory fixtures explicitly install the authored item catalogs.
const { registerItemRow } = await import('../src/game/bag/itemCatalog');
const { STARTER_BAG_ITEMS } = await import('../src/game/bag/starter.generated');
const { PINE_ITEMS } = await import('../src/shards/pine-hollow/items');
for (const row of [...STARTER_BAG_ITEMS, ...PINE_ITEMS, ...DRIFTWOOD_ITEMS]) registerItemRow(row);

beforeEach(() => { localStorage.clear(); });

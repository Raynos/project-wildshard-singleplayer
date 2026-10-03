import { ENGINE_CONTENT_STRINGS } from '../src/game/engineStrings';
import { installEngineStrings } from '../src/engine/strings';
/**
 * Test environment: plain node plus the two browser globals the game's pure modules touch at import time —
 * `localStorage` (Settings / Inventory / Progress / boot timings persist there) and `location` (the chunk registry
 * and the quality tier read `?chunk=` / `?tier=`). A fresh, empty storage for every test; a test that needs storage
 * to throw (iOS private mode) spies on it (`restoreMocks` in vitest.config.ts undoes the spy).
 */
import { beforeEach, vi } from 'vitest';

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

// the app identity first: save keys and the probe's handles are built from it (E405 E414)
const { installAppIdentity } = await import('#engine/app/identity');
const { WILDSHARD_IDENTITY } = await import('#game/identity');
installAppIdentity(WILDSHARD_IDENTITY);
const { registerAchievements } = await import('#game/achievements');
const { PINE_FEATS } = await import('#shards/pine-hollow/feats');
const { DRIFTWOOD_ITEMS, DRIFTWOOD_FEATS } = await import('#shards/driftwood-isle/quest/rows');
registerAchievements('pine-hollow', PINE_FEATS);
registerAchievements('driftwood-isle', DRIFTWOOD_FEATS);

// The composition root owns shared species; the engine has no upward kit import.
const { registerSpecies, speciesWithLook } = await import('#engine');
const { installScore } = await import('#engine/audio/score/score');
const { WILDSHARD_SCORE } = await import('#game/audio/theme');
installScore(WILDSHARD_SCORE);
const { installKitSpecies, installKitIcons, installKitPickups, installKitProps } = await import('#kit');
installKitSpecies();
installKitIcons();
installKitPickups();
installKitProps();
const { installDriftwoodSpecies } = await import('#shards/driftwood-isle/species/install');
installDriftwoodSpecies();
const { installNalatiSpeciesForTests } = await import('#shards/nalati-grasslands/species/rows');
installNalatiSpeciesForTests();
// Legacy fixtures include Pine's spawn-only thrall, without activating a rendered level.
const { PINE_BOAR } = await import('#shards/pine-hollow/species/rows');
const { PINE_BOAR_LOOK } = await import('#shards/pine-hollow/species/looks');
registerSpecies(speciesWithLook(PINE_BOAR, PINE_BOAR_LOOK));
// and its elk thrall (E405: Pine's, derived from the kit's elk)
const { pineElk } = await import('#shards/pine-hollow/species/rows');
const { pineElkLook } = await import('#shards/pine-hollow/species/looks');
registerSpecies(speciesWithLook(pineElk(), pineElkLook()));
// Pure inventory fixtures explicitly install the authored item catalogs.
const { registerItemRow } = await import('#game/bag/itemCatalog');
const { KIT_ITEMS } = await import('#kit/bag/items');
const { PINE_ITEMS } = await import('#shards/pine-hollow/items');
for (const row of [...KIT_ITEMS, ...PINE_ITEMS, ...DRIFTWOOD_ITEMS]) registerItemRow(row);

beforeEach(() => { localStorage.clear(); });

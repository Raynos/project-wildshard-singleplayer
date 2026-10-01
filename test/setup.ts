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

vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('location', new URL('http://localhost:5173/'));

const { registerAchievements } = await import('#game/achievements');
const { PINE_FEATS } = await import('#shards/pine-hollow/feats');
registerAchievements('pine-hollow', PINE_FEATS);

// The composition root owns shared species; the engine has no upward kit import.
const { registerSpecies, speciesWithLook } = await import('#engine');
const { installKitSpecies } = await import('#kit');
installKitSpecies();
// Legacy fixtures include Pine's spawn-only thrall, without activating a rendered level.
const { PINE_BOAR } = await import('#shards/pine-hollow/species/rows');
const { PINE_BOAR_LOOK } = await import('#shards/pine-hollow/species/looks');
registerSpecies(speciesWithLook(PINE_BOAR, PINE_BOAR_LOOK));
beforeEach(() => { localStorage.clear(); });

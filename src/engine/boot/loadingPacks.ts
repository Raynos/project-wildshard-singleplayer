import { jsonSlot } from '../saves/slots';

/** DL16 (E525, on for everyone 2026-11-04): a level's download reads its runtime packs (DL5: a few content-named parts).
 *  The device slot below is a test-harness selector, not a toggle: no UI, no URL; the measuring tools (DL17, DL23, the
 *  goldens, the Simulator readings) write 'shardfile' to read the loose files instead, which also stay the packs' 404
 *  fallback and DL5 / DL20's per-shard choice. The composition root reads it once, before any download starts. */
export const LEVEL_DOWNLOAD_SLOT = 'debug.levelDownload';
// The first read of a page is its value: a pick takes effect only through the row's reload.
let frozen: boolean | undefined;
export function runtimePacksOn(): boolean {
  frozen ??= jsonSlot(LEVEL_DOWNLOAD_SLOT, 'device').read() !== 'shardfile';
  return frozen;
}

/** DL7 P3 + DL6 (G1008): Debug ▸ Loading & memory ▸ Home geometry seed. 'on' (with runtime packs) restores a cold home's
 *  completed geometry from the build's seed, a packs-book member, instead of decoding its files. Default off: a risky
 *  loading change ships behind this row until a Simulator / iPhone reading backs it (E451). A reload row. */
export const HOME_SEED_SLOT = 'debug.homeSeed';
let seedFrozen: boolean | undefined;
export function homeSeedOn(): boolean {
  seedFrozen ??= jsonSlot(HOME_SEED_SLOT, 'device').read() === 'on';
  return seedFrozen;
}

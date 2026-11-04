import { jsonSlot } from '../saves/slots';

/** DL16 (E525): Debug ▸ Loading & memory ▸ Level download. 'packs' makes a level's download read its runtime packs
 *  (DL5: a few content-named parts) instead of its loose files; 'shardfile' (default) keeps the loose files. A reload
 *  row: the composition root reads it once, before any download starts. The row goes when a phone reading flips it
 *  on for everyone (E451). */
export const LEVEL_DOWNLOAD_SLOT = 'debug.levelDownload';
// The first read of a page is its value: a pick takes effect only through the row's reload.
let frozen: boolean | undefined;
export function runtimePacksOn(): boolean {
  frozen ??= jsonSlot(LEVEL_DOWNLOAD_SLOT, 'device').read() === 'packs';
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

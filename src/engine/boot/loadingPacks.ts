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

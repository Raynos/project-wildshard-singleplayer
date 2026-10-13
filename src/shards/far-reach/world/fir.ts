import { onPaintedDispose } from '../look/image';
import type { Texture } from 'three';

/**
 * The card-branch fir's painted branch sheet (E392), loaded by the plugin; the modelled trees (world/trees.ts) replaced
 * the firs it drew, so only the boot and its retirement still hold it.
 */
/** The branch sheet, set by the plugin behind the loading screen. */
let SHEET: Texture | null = null;
export function setFirSheet(t: Texture | null): void {
  SHEET = t;
  onPaintedDispose(t, () => { if (SHEET === t) SHEET = null; });
}
export const firSheet = (): Texture | null => SHEET;

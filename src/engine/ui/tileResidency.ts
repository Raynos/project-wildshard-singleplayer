import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/** pause ▸ Settings ▸ Debug ▸ Tile residency (tile streaming T5, G775): an entered world's tile ring. */
export const TILE_RESIDENCY = ['5x5', '3x3'] as const;
export type TileResidency = (typeof TILE_RESIDENCY)[number];
const saved = jsonSlot('debug.tileResidency', 'device');

/** The saved pick; Developer only (off: the shipped 5 x 5). Read once at load: the row reloads the page. */
export function tileResidency(): TileResidency {
  const value = saved.read();
  return isDev() ? TILE_RESIDENCY.find(choice => choice === value) ?? '5x5' : '5x5';
}
/** Save a pick (the Debug row; the page reloads). */
export function setTileResidency(value: TileResidency): void { saved.write(value); }
/** T10: entered content uses a 3 x 3 or 5 x 5 ring; stale whole-cell picks fall back to 5 x 5. */
export function tileResidencyRadius(value: TileResidency = tileResidency()): number { return value === '3x3' ? 1 : 2; }

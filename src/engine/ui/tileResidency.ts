import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/** pause ▸ Settings ▸ Debug ▸ Tile residency (tile streaming T5, G775): an entered world's tile ring. */
export const TILE_RESIDENCY = ['5x5', '3x3', 'whole'] as const;
export type TileResidency = (typeof TILE_RESIDENCY)[number];
const saved = jsonSlot('debug.tileResidency', 'device');

/** The saved pick; Developer only (off: the shipped 5 x 5). Read once at load: the row reloads the page. */
export function tileResidency(): TileResidency {
  const value = saved.read();
  return isDev() ? TILE_RESIDENCY.find(choice => choice === value) ?? '5x5' : '5x5';
}
/** Save a pick (the Debug row; the page reloads). */
export function setTileResidency(value: TileResidency): void { saved.write(value); }
/** The render ring's radius in 62.5 m tiles for a pick: 3 x 3 is 1, 5 x 5 is 2, the whole 8 x 8 cell is 8. */
export function tileResidencyRadius(value: TileResidency = tileResidency()): number { return value === '3x3' ? 1 : value === 'whole' ? 8 : 2; }

import type { MapExtraLabel, MapExtraRect, MapExtras } from '@wildshard/engine/ui/Minimap';
import { isDev } from '@wildshard/engine/core/devMode';
import { enteredTiles } from './tileDriver';

const SIZE = 62.5, HALF = 250, LINE = 0.8;
const RENDER = 'rgba(80, 200, 120, 0.22)', COLLIDER = 'rgba(255, 190, 70, 0.22)', BORDER = 'rgba(255, 255, 255, 0.55)', LABEL = '#ffffff';

/**
 * Tile streaming T5 (G775): the Developer minimap overlay of the entered world's 62.5 m tiles: every tile border, the
 * resident render ring (green) with its collider 3 x 3 (amber over it), and each tile's declared resident MB. Cell-local
 * metres (a SHARD SELECT page's world). Null while Developer is off or no tiled world is entered.
 */
export function tileOverlay(): MapExtras | null {
  const tiles = isDev() ? enteredTiles() : null;
  if (tiles === null) return null;
  const rects: MapExtraRect[] = [], labels: MapExtraLabel[] = [];
  for (let key = 0; key < 64; key++) {
    const x = -HALF + (key % 8 + 0.5) * SIZE, z = -HALF + (Math.floor(key / 8) + 0.5) * SIZE;
    if (tiles.render.has(key)) rects.push({ x, z, hx: SIZE / 2, hz: SIZE / 2, color: RENDER });
    if (tiles.colliders.has(key)) rects.push({ x, z, hx: SIZE / 2, hz: SIZE / 2, color: COLLIDER });
    const bytes = tiles.bytes.get(key) ?? 0;
    if (bytes > 0) labels.push({ x, z, text: `${(bytes / 1048576).toFixed(1)} MB`, color: LABEL });
  }
  for (let i = 0; i <= 8; i++) {
    const at = -HALF + i * SIZE;
    rects.push({ x: at, z: 0, hx: LINE / 2, hz: HALF, color: BORDER }, { x: 0, z: at, hx: HALF, hz: LINE / 2, color: BORDER });
  }
  return { rects, images: [], labels };
}

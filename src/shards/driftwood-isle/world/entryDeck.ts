import type { DryRect } from './sea';

/** Native floor ownership on the admitted road-deck footprints, inclusive at the edges. */
export function onDeck(rects: readonly DryRect[], x: number, z: number): boolean {
  return rects.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

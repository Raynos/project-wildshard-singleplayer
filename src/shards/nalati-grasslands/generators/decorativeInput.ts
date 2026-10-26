import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { decorativeRowsOnGround } from './decorative';

/** Freeze both device profiles on the same admitted terrain used by play. */
export function decorativeRows(bytes: Uint8Array): ReturnType<typeof decorativeRowsOnGround> {
  return decorativeRowsOnGround(readNativeTerrain(bytes).heightAt);
}

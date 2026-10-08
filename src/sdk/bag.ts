import { normalizeItemRow as platformNormalizeItemRow } from '@wildshard/game/bag/items';

/** A game bag row, including its optional travel permission and presentation metadata. */
export type ItemRow = Parameters<typeof platformNormalizeItemRow>[0];
/** A registered bag row with the default travel refusal made explicit. */
export type RegisteredItemRow = ReturnType<typeof platformNormalizeItemRow>;
/** Normalize bag metadata without installing rows or changing their ids, labels or icons. */
export const normalizeItemRow: typeof platformNormalizeItemRow = platformNormalizeItemRow;

import type { BowVariantRows } from '@wildshard/format/bowVariantRows';

/** The bow variant rows (bake-gear.mjs writes them; a committed authored input since GR6). */
declare const variant: BowVariantRows;
// oxlint-disable-next-line import/no-default-export -- TypeScript requires a default declaration for this JSON module.
export default variant;

// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import product from './generators/product';

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default product;

/** Explicit standalone author-source ceiling; this project has no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };

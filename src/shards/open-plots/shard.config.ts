// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import { outputs as ideaOutputs, product } from './generators/product';

/** Every output, keyed by its product slug (`wildshard build --output=<slug>`, scripts/shard-outputs.mjs). */
export const outputs = ideaOutputs;

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration; an output build selects from `outputs`.
export default product;

/** Explicit standalone author-source ceiling; this project has no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };

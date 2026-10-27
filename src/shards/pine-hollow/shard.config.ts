// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import product from './generators/product';
import { generate as generatePine } from './generators/generate';

/** GR8 (G19): the source program computes the declaration's ctx-read rows before admission. */
export const generate: typeof generatePine = generatePine;
// oxlint-disable-next-line import/no-default-export -- Documented entry for SDK author projects.
export default product;

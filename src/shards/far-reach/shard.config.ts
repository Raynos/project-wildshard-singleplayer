// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import { generate as generateSky } from './generators/generate';
// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import product from './generators/product';

/** Source generation owns the declaration, admitted geometry and boot discovery. */
export const generate = generateSky;
// oxlint-disable-next-line import/no-default-export -- Retain the declaration for offline consumers; SDK builds use generate.
export default product;

// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import { generate as generateSky } from './generators/generate';

/** Source generation owns the declaration, admitted geometry and boot discovery. */
export const generate = generateSky;
// oxlint-disable-next-line import/no-default-export -- The documented author entry selects its complete source constructor.
export default generateSky;

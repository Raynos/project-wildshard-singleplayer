import { generate as generateNine } from './generators/generate';

/** Source generation owns both the declaration and its admitted output. */
export const generate: typeof generateNine = generateNine;
// oxlint-disable-next-line import/no-default-export -- The documented author entry is the source program.
export default generate;

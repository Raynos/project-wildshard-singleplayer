import { generate as generateSunscar } from './generators/generate';

/** One source program owns both the declaration and its admitted output. */
export const generate: typeof generateSunscar = generateSunscar;
// oxlint-disable-next-line import/no-default-export -- The documented author entry is the source program.
export default generate;

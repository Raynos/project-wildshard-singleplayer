import { generate as generatePine } from './generators/generate';

/** GR8 (G19): the source program admits the declaration with the rows it reads through ctx. */
export const generate: typeof generatePine = generatePine;
// oxlint-disable-next-line import/no-default-export -- The documented author entry is the source program.
export default generate;

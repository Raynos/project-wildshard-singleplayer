import { generate as generateBlender } from './generators/generate';
// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import { project, behaviour as blenderBehaviour } from './generators/project';

/** The SDK compiles and meters the door, then admits its critical bytes. */
export const behaviour: typeof blenderBehaviour = blenderBehaviour;
/** One source program owns the declaration, its ground output and its map (GR9). */
export const generate: typeof generateBlender = generateBlender;
// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration (its build runs `generate`).
export default project;
/** Explicit standalone author-source ceiling; no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };

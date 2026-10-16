import { PINE_OUTPUT } from '../data/output';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT };
/** The data/ values runtime/const.ts copies; the build proves the copied runtime still equals them. */
export const mirrors = [...RUNTIME_MIRRORS];

import { PINE_OUTPUT } from '../data/output';

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT };

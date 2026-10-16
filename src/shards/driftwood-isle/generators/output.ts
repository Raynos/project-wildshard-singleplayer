import { DRIFTWOOD_OUTPUT } from '../data/output';

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...DRIFTWOOD_OUTPUT };

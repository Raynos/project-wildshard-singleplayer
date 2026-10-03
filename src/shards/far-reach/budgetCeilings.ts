import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 208.78265953063965
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 323.2365474700928
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

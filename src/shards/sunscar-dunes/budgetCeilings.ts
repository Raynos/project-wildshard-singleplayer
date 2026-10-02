import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 81.50774383544922
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 175.8492660522461
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

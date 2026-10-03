import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 206.53481483459473
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 320.98870277404785
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

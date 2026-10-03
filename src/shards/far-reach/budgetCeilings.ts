import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 185.52279663085938
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 299.9766845703125
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

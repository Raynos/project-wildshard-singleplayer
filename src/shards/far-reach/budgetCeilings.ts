import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 191.4505500793457
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 305.9044380187988
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

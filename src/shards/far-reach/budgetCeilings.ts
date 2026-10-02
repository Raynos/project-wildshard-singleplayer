import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 78.6312026977539
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 173.0034637451172
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

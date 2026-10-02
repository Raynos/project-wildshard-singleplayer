import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 94.7627258300782
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 199.330810546875
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

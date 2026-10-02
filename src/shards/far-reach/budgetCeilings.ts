import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 94.76653671264648
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 199.33462142944336
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

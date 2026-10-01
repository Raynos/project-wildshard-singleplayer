import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 76.62936401367188
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 170.9737091064453
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 82.10445785522461
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 176.44598007202148
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

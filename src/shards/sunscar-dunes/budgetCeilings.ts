import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 79.11913681030273
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 173.4606590270996
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

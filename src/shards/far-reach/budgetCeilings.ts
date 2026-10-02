import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 78.33084869384766
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 172.67530059814453
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

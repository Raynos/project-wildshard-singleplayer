import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 57.324119567871094
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 172.10171127319336
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

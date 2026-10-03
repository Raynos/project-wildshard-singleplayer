import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 234.38562965393066
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 348.8395175933838
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

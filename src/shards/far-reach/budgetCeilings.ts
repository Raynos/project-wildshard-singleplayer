import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 249.1324291229248
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 363.58631706237793
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

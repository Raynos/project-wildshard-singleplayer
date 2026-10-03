import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 157.95073699951172
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 272.40462493896484
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

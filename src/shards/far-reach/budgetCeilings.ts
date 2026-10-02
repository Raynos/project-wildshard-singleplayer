import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 91.66332244873047
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 196.0875549316407
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

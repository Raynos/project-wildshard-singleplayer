import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 108.28093719482422
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

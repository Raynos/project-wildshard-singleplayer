import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 122.6595687866211
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 227.22667694091797
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

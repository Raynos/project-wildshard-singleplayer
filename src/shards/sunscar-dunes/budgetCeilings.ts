import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 79.29098892211914
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 173.63251113891602
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

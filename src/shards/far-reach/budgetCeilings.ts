import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 210.81488609313965
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 325.2687740325928
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

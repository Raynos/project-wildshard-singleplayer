import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 76.73144912719727
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 171.08098220825195
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

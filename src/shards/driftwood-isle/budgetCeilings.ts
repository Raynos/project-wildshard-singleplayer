import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "beach": {
      "gpuMB": 219.43689823150635
    },
    "pier": {
      "gpuMB": 219.43689823150635
    },
    "wreck": {
      "gpuMB": 219.43689823150635
    }
  },
  "desktop": {
    "beach": {
      "gpuMB": 583.5372714996338
    },
    "pier": {
      "gpuMB": 583.5372714996338
    },
    "wreck": {
      "gpuMB": 583.5372714996338
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

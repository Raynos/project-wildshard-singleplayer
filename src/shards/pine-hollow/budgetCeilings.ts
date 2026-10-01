import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "cabin": {
      "gpuMB": 587.1324214935303
    },
    "gate": {
      "gpuMB": 587.1324214935303
    },
    "pond": {
      "gpuMB": 587.1324214935303
    }
  },
  "desktop": {
    "cabin": {
      "gpuMB": 1308.288724899292
    },
    "gate": {
      "gpuMB": 1308.288724899292
    },
    "pond": {
      "gpuMB": 1308.288724899292
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

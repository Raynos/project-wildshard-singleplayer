import type { LevelSpec } from '@wildshard/engine/level/spec';

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
      "gpuMB": 1318.5415477752686
    },
    "gate": {
      "gpuMB": 1318.5415477752686
    },
    "pond": {
      "gpuMB": 1318.5415477752686
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

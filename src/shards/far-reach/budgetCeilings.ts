import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 266.4460048675537
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 380.89989280700684
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

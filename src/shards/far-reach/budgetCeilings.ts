import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 95.12134170532227
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 199.68942642211914
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

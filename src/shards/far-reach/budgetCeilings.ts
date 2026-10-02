import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 77.98888397216797
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 172.33235931396484
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

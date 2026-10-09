import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 152.91958236694336
    },
    "spawn": {
      "gpuMB": 152.91958236694336
    },
    "whip": {
      "gpuMB": 152.91958236694336
    },
    "ray": {
      "gpuMB": 152.91958236694336
    },
    "quest": {
      "gpuMB": 152.91958236694336
    },
    "tower": {
      "gpuMB": 152.91958236694336
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

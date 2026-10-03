import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 149.95301818847656
    },
    "spawn": {
      "gpuMB": 149.95301818847656
    },
    "whip": {
      "gpuMB": 149.95301818847656
    },
    "ray": {
      "gpuMB": 149.95301818847656
    },
    "quest": {
      "gpuMB": 149.95301818847656
    },
    "tower": {
      "gpuMB": 149.95301818847656
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

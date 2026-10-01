import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "D": {
      "gpuMB": 271.43809032440186
    },
    "spawn-rail": {
      "gpuMB": 253.6043882369995
    },
    "stair-street": {
      "gpuMB": 253.6043882369995
    },
    "well-edge": {
      "gpuMB": 253.6043882369995
    }
  },
  "desktop": {
    "D": {
      "gpuMB": 574.4839086532593
    },
    "spawn-rail": {
      "gpuMB": 574.168532371521
    },
    "stair-street": {
      "gpuMB": 574.168532371521
    },
    "well-edge": {
      "gpuMB": 574.168532371521
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

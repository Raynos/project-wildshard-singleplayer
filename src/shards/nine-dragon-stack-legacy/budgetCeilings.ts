import type { LevelSpec } from '@wildshard/engine/level/spec';

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
      "gpuMB": 575.1385869979858
    },
    "spawn-rail": {
      "gpuMB": 574.8232107162476
    },
    "stair-street": {
      "gpuMB": 574.8232107162476
    },
    "well-edge": {
      "gpuMB": 574.8232107162476
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "bridge": {
      "gpuMB": 225.7965316772461
    },
    "camp": {
      "gpuMB": 225.7965316772461
    },
    "plains": {
      "gpuMB": 225.7965316772461
    }
  },
  "desktop": {
    "bridge": {
      "gpuMB": 587.9535007476807
    },
    "camp": {
      "gpuMB": 587.9535007476807
    },
    "plains": {
      "gpuMB": 587.9535007476807
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

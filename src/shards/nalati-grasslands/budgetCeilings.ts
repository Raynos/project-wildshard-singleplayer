import type { LevelSpec } from '#engine';

/** X7 immutable F2 rollout ceilings; provenance: budgets/x7-ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "camp": {
      "draws": 79,
      "tris": 1174948,
      "programs": 102,
      "gpuMB": 238.87819290161133
    },
    "bridge": {
      "draws": 90,
      "tris": 1279751,
      "programs": 102,
      "gpuMB": 238.87819290161133
    },
    "plains": {
      "draws": 108,
      "tris": 1292909,
      "programs": 102,
      "gpuMB": 238.87819290161133
    }
  },
  "desktop": {
    "camp": {
      "draws": 202,
      "tris": 4900943,
      "programs": 119,
      "gpuMB": 601.0351619720459
    },
    "bridge": {
      "draws": 468,
      "tris": 6044582,
      "programs": 119,
      "gpuMB": 601.0351619720459
    },
    "plains": {
      "draws": 311,
      "tris": 6124688,
      "programs": 119,
      "gpuMB": 601.0351619720459
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

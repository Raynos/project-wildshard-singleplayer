import type { LevelSpec } from '#engine';

/** X7 immutable F2 rollout ceilings; provenance: budgets/x7-ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "pier": {
      "draws": 223,
      "tris": 1125728,
      "programs": 95,
      "gpuMB": 219.43689823150635
    },
    "beach": {
      "draws": 217,
      "tris": 1065774,
      "programs": 95,
      "gpuMB": 219.43689823150635
    },
    "wreck": {
      "draws": 167,
      "tris": 936154,
      "programs": 95,
      "gpuMB": 219.43689823150635
    }
  },
  "desktop": {
    "pier": {
      "draws": 945,
      "tris": 3295289,
      "programs": 108,
      "gpuMB": 583.5372714996338
    },
    "beach": {
      "draws": 566,
      "tris": 2320154,
      "programs": 108,
      "gpuMB": 583.5372714996338
    },
    "wreck": {
      "draws": 234,
      "tris": 1456452,
      "programs": 108,
      "gpuMB": 583.5372714996338
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

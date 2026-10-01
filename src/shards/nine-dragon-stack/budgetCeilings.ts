import type { LevelSpec } from '#engine';

/** X7 immutable F2 rollout ceilings; provenance: budgets/x7-ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "spawn-rail": {
      "draws": 144,
      "tris": 1427662,
      "programs": 67,
      "gpuMB": 254.9377202987671
    },
    "well-edge": {
      "draws": 128,
      "tris": 1273139,
      "programs": 67,
      "gpuMB": 254.9377202987671
    },
    "stair-street": {
      "draws": 122,
      "tris": 996042,
      "programs": 67,
      "gpuMB": 254.9377202987671
    },
    "D": {
      "draws": 109,
      "tris": 1039194,
      "programs": 67,
      "gpuMB": 272.77142238616943
    }
  },
  "desktop": {
    "spawn-rail": {
      "draws": 171,
      "tris": 1653616,
      "programs": 82,
      "gpuMB": 575.5018644332886
    },
    "well-edge": {
      "draws": 158,
      "tris": 1375200,
      "programs": 82,
      "gpuMB": 575.5018644332886
    },
    "stair-street": {
      "draws": 144,
      "tris": 947634,
      "programs": 82,
      "gpuMB": 575.5018644332886
    },
    "D": {
      "draws": 123,
      "tris": 964738,
      "programs": 82,
      "gpuMB": 575.8172407150269
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

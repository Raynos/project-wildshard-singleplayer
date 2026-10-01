import type { LevelSpec } from '#engine';

/** X7 immutable F2 rollout ceilings; provenance: budgets/x7-ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "gate": {
      "draws": 104,
      "tris": 1152418,
      "programs": 109,
      "gpuMB": 583.8486213684082
    },
    "cabin": {
      "draws": 146,
      "tris": 1324294,
      "programs": 109,
      "gpuMB": 583.8486213684082
    },
    "pond": {
      "draws": 92,
      "tris": 950098,
      "programs": 109,
      "gpuMB": 583.8486213684082
    }
  },
  "desktop": {
    "gate": {
      "draws": 244,
      "tris": 8432496,
      "programs": 116,
      "gpuMB": 1308.288724899292
    },
    "cabin": {
      "draws": 276,
      "tris": 7991860,
      "programs": 116,
      "gpuMB": 1308.288724899292
    },
    "pond": {
      "draws": 184,
      "tris": 5241776,
      "programs": 116,
      "gpuMB": 1308.288724899292
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

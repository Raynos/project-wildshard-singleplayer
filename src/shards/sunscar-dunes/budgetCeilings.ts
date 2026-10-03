import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 109.7502498626709
    },
    "spawn": {
      "gpuMB": 109.7502498626709
    },
    "whip": {
      "gpuMB": 109.7502498626709
    },
    "ray": {
      "gpuMB": 109.7502498626709
    },
    "quest": {
      "gpuMB": 109.7502498626709
    },
    "tower": {
      "gpuMB": 109.7502498626709
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;

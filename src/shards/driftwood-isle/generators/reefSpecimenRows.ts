/** Baked reef inputs; the native world has its own owned batch. */
export interface ReefParams { readonly s: number; readonly rot: number; readonly v: number; readonly shape?: number }
export const REEF_MODEL_SEED = 0x5ea1 ^ 0xc0;
/** The original bounded Explorer defaults and variants; the world has its own owned batch. */
export const REEF_SPECIMENS = {
  "coral": {
    "defaults": {
      "s": 1,
      "rot": 0,
      "v": 0,
      "shape": 0
    },
    "size": [
      3,
      3,
      3
    ],
    "variants": [
      {
        "id": "brain",
        "label": "Brain",
        "params": {
          "shape": 0
        }
      },
      {
        "id": "staghorn",
        "label": "Staghorn",
        "params": {
          "shape": 1,
          "v": 0.3
        }
      },
      {
        "id": "fan",
        "label": "Fan",
        "params": {
          "shape": 2,
          "v": 0.45
        }
      },
      {
        "id": "tube",
        "label": "Tube",
        "params": {
          "shape": 3,
          "v": 0.6
        }
      }
    ]
  },
  "weed": {
    "defaults": {
      "s": 1,
      "rot": 0,
      "v": 0
    },
    "size": [
      3,
      3,
      3
    ],
    "variants": [
      {
        "id": "tint-0",
        "label": "Tint 1",
        "params": {
          "v": 0.125
        }
      },
      {
        "id": "tint-1",
        "label": "Tint 2",
        "params": {
          "v": 0.375
        }
      },
      {
        "id": "tint-2",
        "label": "Tint 3",
        "params": {
          "v": 0.625
        }
      },
      {
        "id": "tint-3",
        "label": "Tint 4",
        "params": {
          "v": 0.875
        }
      }
    ]
  },
  "star": {
    "defaults": {
      "s": 0.7,
      "rot": 0,
      "v": 0
    },
    "size": [
      3,
      1,
      3
    ],
    "variants": [
      {
        "id": "tint-0",
        "label": "Tint 1",
        "params": {
          "v": 0.16666666666666666
        }
      },
      {
        "id": "tint-1",
        "label": "Tint 2",
        "params": {
          "v": 0.5
        }
      },
      {
        "id": "tint-2",
        "label": "Tint 3",
        "params": {
          "v": 0.8333333333333334
        }
      }
    ]
  }
} as const;
export type ReefKind = keyof typeof REEF_SPECIMENS;

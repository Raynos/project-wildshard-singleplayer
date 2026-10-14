import heldPool from './swordPool.generated.json' with {type:'json'};
/** Ordered retained boot and late inventory selections. */
export const DRIFTWOOD_BOOT_FILES = {
  held: {source: {urls: [heldPool.url]}},
  "empty": {
    "source": {
      "urls": []
    }
  },
  "baked": {
    "source": {
      "publicPrefix": "/assets/baked/driftwood-isle/tex/"
    },
    "excludeParts": [
      ".phone."
    ],
    "map": [
      "gpu"
    ]
  },
  "physics": {
    "source": {
      "urls": [
        "/assets/physics/rapier.wasm"
      ]
    }
  },
  "lut": {
    "source": {
      "urls": [
        "/assets/lut/driftwood-isle.bin"
      ]
    }
  },
  "horizon": {
    "source": {
      "urls": [
        "/assets/horizon/driftwood-isle-day.webp",
        "/assets/horizon/driftwood-isle-night.webp"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "island": {
    "source": {
      "urls": [
        "/assets/models/driftwood-blender/island.glb"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "records": {
    "source": {
      "urls": [
        "/assets/models/driftwood-blender/island.json",
        "/assets/models/driftwood-blender/placements.bin"
      ]
    }
  },
  "lights": {
    "source": {
      "urls": {
        "phone": [
          "/assets/models/driftwood-blender/lm-ao.phone.webp",
          "/assets/models/driftwood-blender/lm-bounce.phone.webp"
        ],
        "desktop": [
          "/assets/models/driftwood-blender/lm-ao.webp",
          "/assets/models/driftwood-blender/lm-bounce.webp"
        ]
      }
    },
    "map": [
      "gpu"
    ]
  },
  "cover": {
    "source": {
      "urls": {
        "phone": [
          "/assets/models/driftwood-blender/island-cover.phone.bin"
        ],
        "desktop": [
          "/assets/models/driftwood-blender/island-cover.desktop.bin"
        ]
      }
    }
  },
  "captain": {
    "source": {
      "urls": [
        "/assets/models/driftwood-hero/captain/captain.glb"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "late": {
    "source": {
      "concat": [
        "lut",
        "horizon",
        "island",
        "records",
        "lights",
        "cover",
        "captain"
      ]
    },
    "present": true
  }
} as const;
export const DRIFTWOOD_BOOT_SOURCES = {
  "sky": "empty",
  "baked": "baked",
  "terrain": "empty",
  "trees": "empty",
  "physics": "physics",
  "cabins": "empty",
  "props": "held",
  "art": "empty",
  "music": "empty",
  "sfx": "empty"
} as const;

import { ISLAND_PLAN_FILES as PLAN_FILES } from './islandPlanFiles';
import { REEF_FILES } from './reefFiles';
import { GROUND_FILES } from './groundFiles';
import { OCEAN_FILES } from './oceanFiles';
import { PALM_FILES } from './palmFiles';
import { HIBISCUS_FILES } from './hibiscusFiles';
import { ISLAND_COVER_FILES } from './islandCoverFiles';
/** Ordered retained boot and late inventory selections. */
export const DRIFTWOOD_BOOT_FILES = {
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
      "urls": {
        phone: ["/assets/models/driftwood-blender/island.json", "/assets/models/driftwood-blender/placements.bin", PLAN_FILES.phone.url],
        desktop: ["/assets/models/driftwood-blender/island.json", "/assets/models/driftwood-blender/placements.bin", PLAN_FILES.desktop.url]
      }
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
  "reef": {source: {urls: [REEF_FILES.world]}},
  "ground": {source: {urls: [GROUND_FILES.ground, GROUND_FILES.slab]}},
  "ocean": { source: { urls: { phone: [OCEAN_FILES.phone, OCEAN_FILES.floor], desktop: [OCEAN_FILES.desktop, OCEAN_FILES.floor] } } },
  "palms": { source: { urls: { phone: [PALM_FILES.phone.world], desktop: [PALM_FILES.desktop.world] } } },
  "hibiscus": { source: { urls: { phone: [HIBISCUS_FILES.phone.world], desktop: [HIBISCUS_FILES.desktop.world] } } },
  "cover": {
    "source": {
      "urls": {
        "phone": [
          ISLAND_COVER_FILES.phone.url
        ],
        "desktop": [
          ISLAND_COVER_FILES.desktop.url
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
        "hibiscus",
        "palms",
        "reef",
        "ground",
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
  "props": "empty",
  "art": "empty",
  "music": "empty",
  "sfx": "empty"
} as const;

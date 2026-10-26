import PLAN_FILES from '../data/islandPlanFiles.json' with { type: 'json' };
import { REEF_FILES } from './reefFiles';
import { GROUND_FILES } from './groundFiles';
import { OCEAN_FILES } from './oceanFiles';
import { PALM_FILES } from './palmFiles';
import { HIBISCUS_FILES } from './hibiscusFiles';
import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };

const BAKED_TEXTURE_PREFIX = "/assets/baked/driftwood-isle/tex/";
const PHYSICS_WASM_FILE = "/assets/physics/rapier.wasm";

/** Ordered retained boot and late inventory selections. */
export const DRIFTWOOD_BOOT_FILES: { readonly empty: { readonly source: { readonly urls: readonly []; }; }; readonly baked: { readonly source: { readonly publicPrefix: typeof BAKED_TEXTURE_PREFIX; }; readonly excludeParts: readonly [".phone."]; readonly map: readonly ["gpu"]; }; readonly physics: { readonly source: { readonly urls: readonly [typeof PHYSICS_WASM_FILE]; }; }; readonly lut: { readonly source: { readonly urls: readonly ["/assets/lut/driftwood-isle.bin"]; }; }; readonly horizon: { readonly source: { readonly urls: readonly ["/assets/horizon/driftwood-isle-day.webp", "/assets/horizon/driftwood-isle-night.webp"]; }; readonly map: readonly ["gpu"]; }; readonly island: { readonly source: { readonly urls: readonly ["/assets/models/driftwood-blender/island.glb"]; }; readonly map: readonly ["gpu"]; }; readonly records: { readonly source: { readonly urls: { readonly phone: readonly ["/assets/models/driftwood-blender/placements.bin", string]; readonly desktop: readonly ["/assets/models/driftwood-blender/placements.bin", string]; }; }; }; readonly lights: { readonly source: { readonly urls: { readonly phone: readonly ["/assets/models/driftwood-blender/lm-ao.phone.webp", "/assets/models/driftwood-blender/lm-bounce.phone.webp"]; readonly desktop: readonly ["/assets/models/driftwood-blender/lm-ao.webp", "/assets/models/driftwood-blender/lm-bounce.webp"]; }; }; readonly map: readonly ["gpu"]; }; readonly reef: { readonly source: { readonly urls: readonly [typeof REEF_FILES.world]; }; }; readonly ground: { readonly source: { readonly urls: readonly [typeof GROUND_FILES.ground, typeof GROUND_FILES.slab]; }; }; readonly ocean: { readonly source: { readonly urls: { readonly phone: readonly [typeof OCEAN_FILES.phone, typeof OCEAN_FILES.floor]; readonly desktop: readonly [typeof OCEAN_FILES.desktop, typeof OCEAN_FILES.floor]; }; }; }; readonly palms: { readonly source: { readonly urls: { readonly phone: readonly [typeof PALM_FILES.phone.world]; readonly desktop: readonly [typeof PALM_FILES.desktop.world]; }; }; }; readonly hibiscus: { readonly source: { readonly urls: { readonly phone: readonly [typeof HIBISCUS_FILES.phone.world]; readonly desktop: readonly [typeof HIBISCUS_FILES.desktop.world]; }; }; }; readonly cover: { readonly source: { readonly urls: { readonly phone: readonly [string]; readonly desktop: readonly [string]; }; }; }; readonly captain: { readonly source: { readonly urls: readonly ["/assets/models/driftwood-hero/captain/captain.glb"]; }; readonly map: readonly ["gpu"]; }; readonly late: { readonly source: { readonly concat: readonly ["lut", "horizon", "island", "records", "lights", "cover", "hibiscus", "palms", "reef", "ground", "captain"]; }; readonly present: true; }; } = {
  "empty": {
    "source": {
      "urls": []
    }
  },
  "baked": {
    "source": {
      "publicPrefix": BAKED_TEXTURE_PREFIX
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
        PHYSICS_WASM_FILE
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
        phone: ["/assets/models/driftwood-blender/placements.bin", PLAN_FILES.phone.url],
        desktop: ["/assets/models/driftwood-blender/placements.bin", PLAN_FILES.desktop.url]
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

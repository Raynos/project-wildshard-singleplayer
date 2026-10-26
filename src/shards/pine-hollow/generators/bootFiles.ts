import treeRest from '../data/treeRest.generated.json' with {type:'json'};
import painted from '../data/paintedTextures.generated.json' with {type:'json'};
import skins from '../data/npcSkins.generated.json' with {type:'json'};

const PINE_BOOT_ASSET_1="/assets/baked/pine-hollow/sky.json";
const PINE_BOOT_ASSET_2="/assets/baked/pine-hollow/tex/";
const PINE_BOOT_ASSET_3="/assets/models/Lantern_01/Lantern_01_lod.glb";
const PINE_BOOT_ASSET_4="/assets/models/rock_moss_set_01/rock_moss_set_01_lod.glb";
const PINE_BOOT_ASSET_5="/assets/models/tree_stump_01/tree_stump_01_lod.glb";
const PINE_BOOT_ASSET_6="/assets/models/dead_tree_trunk/dead_tree_trunk_lod.glb";
const PINE_BOOT_ASSET_7="/assets/pine-hollow/weapons/lever-rifle.glb";
const PINE_BOOT_ASSET_8="/assets/pine-hollow/weapons/skinning-knife.glb";
const PINE_BOOT_ASSET_9="/assets/pine-hollow/npcs/ranger.glb";
const PINE_BOOT_ASSET_10="/assets/pine-hollow/npcs/trader.glb";
const PINE_BOOT_ASSET_11="/assets/pine-hollow/npcs/miller.glb";
const PINE_BOOT_ASSET_12="/assets/baked/pine-hollow/navmesh.bin";
const PINE_BOOT_ASSET_13="/assets/physics/rapier.wasm";

/** Ordered boot selections; GPU inventory and admitted prop/coat aliases are borrowed at resolution. */
export const PINE_BOOT_FILES: {
    readonly skyHdr: {
        readonly source: {
            readonly available: readonly [
                "/assets/hdri/qwantani_sunset_puresky_2k.sky.jpg",
                "/assets/hdri/qwantani_sunset_puresky_2k.gain.png"
            ];
            readonly fallback: readonly [
                "/assets/hdri/qwantani_sunset_puresky_2k.hdr"
            ];
        };
    };
    readonly skyBake: {
        readonly source: {
            readonly urls: readonly [
                typeof PINE_BOOT_ASSET_1
            ];
        };
        readonly present: true;
    };
    readonly skyKeys: {
        readonly source: {
            readonly urls: readonly [
                "/assets/hdri/qwantani_dawn_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_dawn_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_sunrise_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_sunrise_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_mid_morning_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_late_afternoon_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_late_afternoon_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_sunset_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_sunset_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_dusk_2_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_dusk_2_puresky_2k.key.gain.png",
                "/assets/hdri/qwantani_moon_noon_puresky_2k.key.jpg",
                "/assets/hdri/qwantani_moon_noon_puresky_2k.key.gain.png"
            ];
        };
        readonly present: true;
    };
    readonly empty: {
        readonly source: {
            readonly urls: readonly [
            ];
        };
    };
    readonly sky: {
        readonly source: {
            readonly concat: readonly [
                "skyHdr",
                "skyBake",
                "skyKeys"
            ];
        };
        readonly map: readonly [
            "gpu"
        ];
    };
    readonly baked: {
        readonly source: {
            readonly publicPrefix: typeof PINE_BOOT_ASSET_2;
        };
        readonly excludeParts: readonly [
            ".phone."
        ];
        readonly excludeBasenamePrefix: "fur-";
        readonly map: readonly [
            "gpu"
        ];
    };
    readonly terrainLayers: {
        readonly source: {
            readonly pbr: readonly [
                "forrest_ground_03",
                "leafy_grass",
                "rock_ground",
                "stony_dirt_path"
            ];
        };
        readonly map: readonly [
            "layer"
        ];
    };
    readonly terrainRock: {
        readonly source: {
            readonly pbr: readonly [
                "rock_ground"
            ];
        };
    };
    readonly terrain: {
        readonly source: {
            readonly concat: readonly [
                "terrainLayers",
                "terrainRock"
            ];
        };
        readonly unique: true;
        readonly map: readonly [
            "gpu"
        ];
    };
    readonly treeMeshes: {
        readonly source: {
            readonly urls: readonly [
                string,
                "/assets/models/pine-hollow-trees/cards-albedo.png",
                "/assets/models/pine-hollow-trees/cards-normal.jpg",
                "/assets/models/pine-hollow-trees/cards-arm.jpg",
                "/assets/models/pine-hollow-trees/impostor-albedo.png",
                "/assets/models/pine-hollow-trees/impostor-normal.jpg"
            ];
        };
    };
    readonly treeBark: {
        readonly source: {
            readonly pbr: readonly [
                "pine_bark",
                "fir_bark",
                "metasequoia_bark",
                "birch_bark",
                "bark_willow_02"
            ];
        };
        readonly map: readonly [
            "layer"
        ];
    };
    readonly trees: {
        readonly source: {
            readonly concat: readonly [
                "treeMeshes",
                "treeBark"
            ];
        };
        readonly unique: true;
        readonly map: readonly [
            "gpu"
        ];
    };
    readonly layered: {
        readonly source: {
            readonly concat: readonly [
                "terrain",
                "trees"
            ];
        };
        readonly unique: true;
    };
    readonly cabinPbr: {
        readonly source: {
            readonly pbr: readonly [
                "wood_trunk_wall",
                "wood_planks_grey",
                "wood_planks_dirt",
                "rough_pine_door",
                "stone_wall",
                "pine_bark"
            ];
        };
    };
    readonly cabinGltf: {
        readonly source: {
            readonly gltf: readonly [
                "stone_fire_pit",
                "wooden_crate_02",
                "wine_barrel_01",
                "wooden_bucket_01",
                "hatchet"
            ];
        };
    };
    readonly lantern: {
        readonly source: {
            readonly urls: readonly [
                typeof PINE_BOOT_ASSET_3
            ];
        };
    };
    readonly cabins: {
        readonly source: {
            readonly concat: readonly [
                "cabinPbr",
                "cabinGltf",
                "lantern"
            ];
        };
        readonly unique: true;
        readonly map: readonly [
            "gpu"
        ];
        readonly except: "layered";
    };
    readonly rocks: {
        readonly source: {
            readonly urls: readonly [
                typeof PINE_BOOT_ASSET_4,
                typeof PINE_BOOT_ASSET_5,
                typeof PINE_BOOT_ASSET_6
            ];
        };
        readonly unique: true;
    };
    readonly world: {
        readonly source: {
            readonly urls: {
                readonly phone: readonly [
                    "/assets/lut/pine-hollow.bin",
                    "/assets/horizon/pine-hollow-day-phone.webp",
                    "/assets/horizon/pine-hollow-night-phone.webp",
                    typeof PINE_BOOT_ASSET_7,
                    typeof PINE_BOOT_ASSET_8,
                    typeof PINE_BOOT_ASSET_9,
                    string,
                    typeof PINE_BOOT_ASSET_10,
                    string,
                    typeof PINE_BOOT_ASSET_11,
                    string,
                    ...string[],
                    "/assets/pine-hollow/baked/rain.phone.bin"
                ];
                readonly desktop: readonly [
                    "/assets/lut/pine-hollow.bin",
                    "/assets/horizon/pine-hollow-day.webp",
                    "/assets/horizon/pine-hollow-night.webp",
                    typeof PINE_BOOT_ASSET_7,
                    typeof PINE_BOOT_ASSET_8,
                    typeof PINE_BOOT_ASSET_9,
                    string,
                    typeof PINE_BOOT_ASSET_10,
                    string,
                    typeof PINE_BOOT_ASSET_11,
                    string,
                    ...string[],
                    "/assets/pine-hollow/baked/rain.bin"
                ];
            };
        };
        readonly map: readonly [
            "gpu"
        ];
        readonly present: true;
    };
    readonly heroes: {
        readonly source: {
            readonly urls: readonly [
                "/assets/models/pine-hollow-hero/stone-a/stone-a.glb",
                "/assets/models/pine-hollow-hero/stone-a-lod1/stone-a-lod1.glb",
                "/assets/models/pine-hollow-hero/stone-b/stone-b.glb",
                "/assets/models/pine-hollow-hero/stone-b-lod1/stone-b-lod1.glb",
                "/assets/models/pine-hollow-hero/stone-c/stone-c.glb",
                "/assets/models/pine-hollow-hero/stone-c-lod1/stone-c-lod1.glb",
                "/assets/models/pine-hollow-hero/waystone/waystone.glb",
                "/assets/models/pine-hollow-hero/waystone-lod1/waystone-lod1.glb",
                "/assets/models/pine-hollow-hero/contract-board/contract-board.glb",
                "/assets/models/pine-hollow-hero/contract-board-lod1/contract-board-lod1.glb",
                "/assets/models/pine-hollow-hero/cave-arch/cave-arch.glb",
                "/assets/models/pine-hollow-hero/cave-arch-lod1/cave-arch-lod1.glb",
                "/assets/models/pine-hollow-hero/beaver-dam/beaver-dam.glb",
                "/assets/models/pine-hollow-hero/beaver-dam-lod1/beaver-dam-lod1.glb",
                "/assets/models/pine-hollow-hero/canoe/canoe.glb",
                "/assets/models/pine-hollow-hero/canoe-lod1/canoe-lod1.glb",
                "/assets/tex/mossy_rock/diffuse.jpg",
                "/assets/tex/mossy_rock/nor_gl.jpg",
                "/assets/tex/mossy_rock/arm.jpg"
            ];
        };
        readonly present: true;
    };
    readonly propBase: {
        readonly source: {
            readonly concat: readonly [
                "world",
                "rocks",
                "heroes"
            ];
        };
        readonly map: readonly [
            "gpu"
        ];
        readonly aliases: "props";
    };
    readonly coats: {
        readonly source: {
            readonly pages: "coats";
        };
    };
    readonly viewmodels: {
        readonly source: {
            readonly tablePrefix: "procedural:/assets/baked/pine-hollow/viewmodel/";
        };
    };
    readonly props: {
        readonly source: {
            readonly concat: readonly [
                "propBase",
                "coats",
                "viewmodels"
            ];
        };
    };
    readonly nav: {
        readonly source: {
            readonly urls: readonly [
                typeof PINE_BOOT_ASSET_12
            ];
        };
        readonly present: true;
    };
    readonly rapier: {
        readonly source: {
            readonly urls: readonly [
                typeof PINE_BOOT_ASSET_13
            ];
        };
    };
    readonly physics: {
        readonly source: {
            readonly concat: readonly [
                "rapier",
                "nav"
            ];
        };
    };
} = {
  "skyHdr": {
    "source": {
      "available": [
        "/assets/hdri/qwantani_sunset_puresky_2k.sky.jpg",
        "/assets/hdri/qwantani_sunset_puresky_2k.gain.png"
      ],
      "fallback": [
        "/assets/hdri/qwantani_sunset_puresky_2k.hdr"
      ]
    }
  },
  "skyBake": {
    "source": {
      "urls": [
        PINE_BOOT_ASSET_1
      ]
    },
    "present": true
  },
  "skyKeys": {
    "source": {
      "urls": [
        "/assets/hdri/qwantani_dawn_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_dawn_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_sunrise_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_sunrise_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_mid_morning_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_late_afternoon_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_late_afternoon_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_sunset_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_sunset_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_dusk_2_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_dusk_2_puresky_2k.key.gain.png",
        "/assets/hdri/qwantani_moon_noon_puresky_2k.key.jpg",
        "/assets/hdri/qwantani_moon_noon_puresky_2k.key.gain.png"
      ]
    },
    "present": true
  },
  "empty": {
    "source": {
      "urls": []
    }
  },
  "sky": {
    "source": {
      "concat": [
        "skyHdr",
        "skyBake",
        "skyKeys"
      ]
    },
    "map": [
      "gpu"
    ]
  },
  "baked": {
    "source": {
      "publicPrefix": PINE_BOOT_ASSET_2
    },
    "excludeParts": [
      ".phone."
    ],
    "excludeBasenamePrefix": "fur-",
    "map": [
      "gpu"
    ]
  },
  "terrainLayers": {
    "source": {
      "pbr": [
        "forrest_ground_03",
        "leafy_grass",
        "rock_ground",
        "stony_dirt_path"
      ]
    },
    "map": [
      "layer"
    ]
  },
  "terrainRock": {
    "source": {
      "pbr": [
        "rock_ground"
      ]
    }
  },
  "terrain": {
    "source": {
      "concat": [
        "terrainLayers",
        "terrainRock"
      ]
    },
    "unique": true,
    "map": [
      "gpu"
    ]
  },
  "treeMeshes": {
    "source": {
      "urls": [
        treeRest.geometry,
        "/assets/models/pine-hollow-trees/cards-albedo.png",
        "/assets/models/pine-hollow-trees/cards-normal.jpg",
        "/assets/models/pine-hollow-trees/cards-arm.jpg",
        "/assets/models/pine-hollow-trees/impostor-albedo.png",
        "/assets/models/pine-hollow-trees/impostor-normal.jpg"
      ]
    }
  },
  "treeBark": {
    "source": {
      "pbr": [
        "pine_bark",
        "fir_bark",
        "metasequoia_bark",
        "birch_bark",
        "bark_willow_02"
      ]
    },
    "map": [
      "layer"
    ]
  },
  "trees": {
    "source": {
      "concat": [
        "treeMeshes",
        "treeBark"
      ]
    },
    "unique": true,
    "map": [
      "gpu"
    ]
  },
  "layered": {
    "source": {
      "concat": [
        "terrain",
        "trees"
      ]
    },
    "unique": true
  },
  "cabinPbr": {
    "source": {
      "pbr": [
        "wood_trunk_wall",
        "wood_planks_grey",
        "wood_planks_dirt",
        "rough_pine_door",
        "stone_wall",
        "pine_bark"
      ]
    }
  },
  "cabinGltf": {
    "source": {
      "gltf": [
        "stone_fire_pit",
        "wooden_crate_02",
        "wine_barrel_01",
        "wooden_bucket_01",
        "hatchet"
      ]
    }
  },
  "lantern": {
    "source": {
      "urls": [
        PINE_BOOT_ASSET_3
      ]
    }
  },
  "cabins": {
    "source": {
      "concat": [
        "cabinPbr",
        "cabinGltf",
        "lantern"
      ]
    },
    "unique": true,
    "map": [
      "gpu"
    ],
    "except": "layered"
  },
  "rocks": {
    "source": {
      "urls": [
        PINE_BOOT_ASSET_4,
        PINE_BOOT_ASSET_5,
        PINE_BOOT_ASSET_6
      ]
    },
    "unique": true
  },
  "world": {
    "source": {
      "urls": {
        "phone": [
          "/assets/lut/pine-hollow.bin",
          "/assets/horizon/pine-hollow-day-phone.webp",
          "/assets/horizon/pine-hollow-night-phone.webp",
          PINE_BOOT_ASSET_7,
          PINE_BOOT_ASSET_8,
          PINE_BOOT_ASSET_9, skins.ranger.phone.url,
          PINE_BOOT_ASSET_10, skins.trader.phone.url,
          PINE_BOOT_ASSET_11, skins.miller.phone.url,
          ...painted.urls,
          "/assets/pine-hollow/baked/rain.phone.bin"
        ],
        "desktop": [
          "/assets/lut/pine-hollow.bin",
          "/assets/horizon/pine-hollow-day.webp",
          "/assets/horizon/pine-hollow-night.webp",
          PINE_BOOT_ASSET_7,
          PINE_BOOT_ASSET_8,
          PINE_BOOT_ASSET_9, skins.ranger.desktop.url,
          PINE_BOOT_ASSET_10, skins.trader.desktop.url,
          PINE_BOOT_ASSET_11, skins.miller.desktop.url,
          ...painted.urls,
          "/assets/pine-hollow/baked/rain.bin"
        ]
      }
    },
    "map": [
      "gpu"
    ],
    "present": true
  },
  "heroes": {
    "source": {
      "urls": [
        "/assets/models/pine-hollow-hero/stone-a/stone-a.glb",
        "/assets/models/pine-hollow-hero/stone-a-lod1/stone-a-lod1.glb",
        "/assets/models/pine-hollow-hero/stone-b/stone-b.glb",
        "/assets/models/pine-hollow-hero/stone-b-lod1/stone-b-lod1.glb",
        "/assets/models/pine-hollow-hero/stone-c/stone-c.glb",
        "/assets/models/pine-hollow-hero/stone-c-lod1/stone-c-lod1.glb",
        "/assets/models/pine-hollow-hero/waystone/waystone.glb",
        "/assets/models/pine-hollow-hero/waystone-lod1/waystone-lod1.glb",
        "/assets/models/pine-hollow-hero/contract-board/contract-board.glb",
        "/assets/models/pine-hollow-hero/contract-board-lod1/contract-board-lod1.glb",
        "/assets/models/pine-hollow-hero/cave-arch/cave-arch.glb",
        "/assets/models/pine-hollow-hero/cave-arch-lod1/cave-arch-lod1.glb",
        "/assets/models/pine-hollow-hero/beaver-dam/beaver-dam.glb",
        "/assets/models/pine-hollow-hero/beaver-dam-lod1/beaver-dam-lod1.glb",
        "/assets/models/pine-hollow-hero/canoe/canoe.glb",
        "/assets/models/pine-hollow-hero/canoe-lod1/canoe-lod1.glb",
        "/assets/tex/mossy_rock/diffuse.jpg",
        "/assets/tex/mossy_rock/nor_gl.jpg",
        "/assets/tex/mossy_rock/arm.jpg"
      ]
    },
    "present": true
  },
  "propBase": {
    "source": {
      "concat": [
        "world",
        "rocks",
        "heroes"
      ]
    },
    "map": [
      "gpu"
    ],
    "aliases": "props"
  },
  "coats": {
    "source": {
      "pages": "coats"
    }
  },
  "viewmodels": {
    "source": {
      "tablePrefix": "procedural:/assets/baked/pine-hollow/viewmodel/"
    }
  },
  "props": {
    "source": {
      "concat": [
        "propBase",
        "coats",
        "viewmodels"
      ]
    }
  },
  "nav": {
    "source": {
      "urls": [
        PINE_BOOT_ASSET_12
      ]
    },
    "present": true
  },
  "rapier": {
    "source": {
      "urls": [
        PINE_BOOT_ASSET_13
      ]
    }
  },
  "physics": {
    "source": {
      "concat": [
        "rapier",
        "nav"
      ]
    }
  }
} as const;
export const PINE_BOOT_SOURCES = {
  "sky": "sky",
  "baked": "baked",
  "terrain": "terrain",
  "trees": "trees",
  "physics": "physics",
  "cabins": "cabins",
  "props": "props",
  "art": "empty",
  "music": "empty",
  "sfx": "empty"
} as const;
/** Ordered boot selections; GPU inventory and admitted prop/coat aliases are borrowed at resolution. */
export const PINE_BOOT_FILES = {
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
        "/assets/baked/pine-hollow/sky.json"
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
      "publicPrefix": "/assets/baked/pine-hollow/tex/"
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
        "/assets/models/pine-hollow-trees/trees.glb",
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
        "/assets/models/Lantern_01/Lantern_01_lod.glb"
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
        "/assets/models/rock_moss_set_01/rock_moss_set_01_lod.glb",
        "/assets/models/tree_stump_01/tree_stump_01_lod.glb",
        "/assets/models/dead_tree_trunk/dead_tree_trunk_lod.glb"
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
          "/assets/pine-hollow/weapons/lever-rifle.glb",
          "/assets/pine-hollow/weapons/skinning-knife.glb",
          "/assets/pine-hollow/life/birds.glb",
          "/assets/pine-hollow/life/birds.json",
          "/assets/pine-hollow/npcs/ranger.glb",
          "/assets/pine-hollow/npcs/trader.glb",
          "/assets/pine-hollow/npcs/miller.glb",
          "/assets/pine-hollow/journal/chalk.webp",
          "/assets/pine-hollow/baked/wildlife.glb",
          "/assets/pine-hollow/creatures/thrall-extras.phone.glb",
          "/assets/pine-hollow/baked/rain.phone.bin"
        ],
        "desktop": [
          "/assets/lut/pine-hollow.bin",
          "/assets/horizon/pine-hollow-day.webp",
          "/assets/horizon/pine-hollow-night.webp",
          "/assets/pine-hollow/weapons/lever-rifle.glb",
          "/assets/pine-hollow/weapons/skinning-knife.glb",
          "/assets/pine-hollow/life/birds.glb",
          "/assets/pine-hollow/life/birds.json",
          "/assets/pine-hollow/npcs/ranger.glb",
          "/assets/pine-hollow/npcs/trader.glb",
          "/assets/pine-hollow/npcs/miller.glb",
          "/assets/pine-hollow/journal/chalk.webp",
          "/assets/pine-hollow/baked/wildlife.glb",
          "/assets/pine-hollow/creatures/thrall-extras.glb",
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
        "/assets/models/pine-hollow-crags/crags.glb",
        "/assets/models/pine-hollow-crags/crags-b.glb",
        "/assets/models/pine-hollow-crags/cave.glb",
        "/assets/models/pine-hollow-crags/cave.json",
        "/assets/tex/mossy_rock/diffuse.jpg",
        "/assets/tex/mossy_rock/nor_gl.jpg",
        "/assets/tex/mossy_rock/arm.jpg"
      ]
    },
    "present": true
  },
  "rigs": {
    "source": {
      "urls": {
        "phone": [
          "/assets/pine-hollow/creatures/deer-hind.phone.rigged.glb",
          "/assets/pine-hollow/creatures/deer-stag.phone.rigged.glb",
          "/assets/pine-hollow/creatures/boar.phone.rigged.glb",
          "/assets/pine-hollow/creatures/elk-cow.phone.rigged.glb",
          "/assets/pine-hollow/creatures/elk-bull.phone.rigged.glb",
          "/assets/pine-hollow/creatures/bear-black.phone.rigged.glb",
          "/assets/pine-hollow/creatures/bear-brown.phone.rigged.glb",
          "/assets/pine-hollow/creatures/antler-king-rig.phone.rigged.glb"
        ],
        "desktop": [
          "/assets/pine-hollow/creatures/deer-hind.rigged.glb",
          "/assets/pine-hollow/creatures/deer-stag.rigged.glb",
          "/assets/pine-hollow/creatures/boar.rigged.glb",
          "/assets/pine-hollow/creatures/elk-cow.rigged.glb",
          "/assets/pine-hollow/creatures/elk-bull.rigged.glb",
          "/assets/pine-hollow/creatures/bear-black.rigged.glb",
          "/assets/pine-hollow/creatures/bear-brown.rigged.glb",
          "/assets/pine-hollow/creatures/antler-king-rig.rigged.glb"
        ]
      }
    },
    "present": true
  },
  "propBase": {
    "source": {
      "concat": [
        "world",
        "rocks",
        "heroes",
        "rigs"
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
        "/assets/baked/pine-hollow/navmesh.bin"
      ]
    },
    "present": true
  },
  "rapier": {
    "source": {
      "urls": [
        "/assets/physics/rapier.wasm"
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

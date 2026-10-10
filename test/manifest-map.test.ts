// E357 F6: all authored manifest data and sampled analytic terrain match the pre-move fixtures.
import { describe, expect, it } from 'vitest';
import { exploreArt } from '../src/engine/level/data';
import { SHARDS } from '../src/shards.generated';
import { formatGrid, terrainFor } from '../src/game/shard/manifest';

// Captured before F6 from the four authored definitions; functions remain lazy hooks.
const ORIGINAL = [
  {
    "data": {
      "id": "chunk://local/driftwood-isle",
      "slug": "driftwood-isle",
      "displayName": "Driftwood Isle",
      "gridCoords": "(−1, +6)",
      "seed": 24225,
      "treeCount": 0,
      "accent": "marigold",
      "biome": "Low-poly island, open ocean",
      "blurb": "A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.",
      "thumbnail": "/src/chunks/thumbs/driftwood-isle.jpg",
      "heroPortrait": "/src/chunks/thumbs/driftwood-isle-portrait.jpg",
      "heroLandscape": "/src/chunks/thumbs/driftwood-isle-landscape.jpg",
      "style": "lowpoly",
      "weapon": "sword",
      "sword": "@function",
      "ocean": {
        "level": 0.8,
        "shallowColor": [
          0,
          0.8,
          0.88
        ],
        "deepColor": [
          0.008,
          0.15,
          0.52
        ],
        "deepDepth": 6
      },
      "explore": true,
      "roster": "@function",
      "pois": [
        {
          "id": "jetty",
          "name": "Jetty",
          "x": 0,
          "z": -226,
          "r": 16
        },
        {
          "id": "hut",
          "name": "Hut",
          "x": -22,
          "z": -64,
          "r": 12
        },
        {
          "id": "shrine",
          "name": "Ring shrine",
          "x": -98,
          "z": 108,
          "r": 16
        },
        {
          "id": "lookout",
          "name": "Lookout",
          "x": 94,
          "z": 94,
          "r": 12
        },
        {
          "id": "wreck",
          "name": "Wreck cove",
          "x": 153,
          "z": 2,
          "r": 20
        },
        {
          "id": "bridge",
          "name": "Rope bridge",
          "x": 24,
          "z": 22,
          "r": 12
        }
      ],
      "terrain": {
        "heightAt": "@function",
        "normalAt": "@function",
        "trailDistance": "@function",
        "cabinMask": "@function",
        "pondMask": "@function",
        "waterLevel": "@function",
        "splatAt": "@function",
        "trails": [
          [
            [
              0,
              -250
            ],
            [
              0,
              -190
            ]
          ],
          [
            [
              0,
              250
            ],
            [
              0,
              190
            ]
          ],
          [
            [
              -250,
              0
            ],
            [
              -190,
              0
            ]
          ],
          [
            [
              250,
              0
            ],
            [
              190,
              0
            ]
          ],
          [
            [
              0,
              -188
            ],
            [
              -8,
              -172
            ],
            [
              -30,
              -142
            ],
            [
              -30,
              -104
            ],
            [
              -24,
              -80
            ],
            [
              -20,
              -68
            ]
          ],
          [
            [
              -20,
              -68
            ],
            [
              -8,
              -50
            ],
            [
              14,
              -24
            ],
            [
              17,
              8
            ],
            [
              15,
              12
            ],
            [
              16,
              14
            ],
            [
              32,
              30
            ],
            [
              34,
              32
            ],
            [
              46,
              46
            ],
            [
              86,
              86
            ],
            [
              88,
              88
            ]
          ],
          [
            [
              17,
              8
            ],
            [
              60,
              0
            ],
            [
              100,
              -2
            ],
            [
              140,
              4
            ]
          ],
          [
            [
              -20,
              -68
            ],
            [
              -52,
              -30
            ],
            [
              -72,
              20
            ],
            [
              -88,
              70
            ],
            [
              -94,
              88
            ],
            [
              -87.5,
              93.7
            ],
            [
              -89.3,
              96.1
            ]
          ]
        ],
        "cabinSites": [],
        "pond": null
      },
      "trees": {
        "factory": "none",
        "noun": "trees"
      },
      "fauna": [
        {
          "kind": "boar",
          "count": 4,
          "variants": [
            "boar",
            "sow",
            "black",
            "big"
          ],
          "anchor": {
            "x": 66,
            "z": -132,
            "rMin": 5,
            "rMax": 20
          },
          "canopy": false,
          "trailBand": [
            8,
            600
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "variants": [
            "boar",
            "sow",
            "black",
            "big"
          ],
          "anchor": {
            "x": -140,
            "z": -30,
            "rMin": 5,
            "rMax": 30
          },
          "canopy": false,
          "trailBand": [
            8,
            600
          ]
        },
        {
          "kind": "boar",
          "count": 4,
          "variants": [
            "boar",
            "sow",
            "black",
            "big"
          ],
          "anchor": {
            "x": 30,
            "z": 150,
            "rMin": 5,
            "rMax": 30
          },
          "canopy": false,
          "trailBand": [
            8,
            600
          ]
        },
        {
          "kind": "bear",
          "count": 1,
          "variants": [
            "brown"
          ],
          "anchor": {
            "x": 56,
            "z": -84,
            "rMin": 4,
            "rMax": 16
          },
          "canopy": false,
          "trailBand": [
            8,
            600
          ]
        },
        {
          "kind": "bear",
          "count": 1,
          "variants": [
            "black",
            "black-blaze"
          ],
          "anchor": {
            "x": -122,
            "z": -100,
            "rMin": 4,
            "rMax": 14
          },
          "canopy": false,
          "trailBand": [
            8,
            600
          ]
        }
      ],
      "maxHitDamage": 20,
      "hitCapExempt": [
        "captain"
      ],
      "loot": {
        "coins": true
      },
      "bodyShadow": true,
      "fightRules": {
        "maxAttackers": 2
      },
      "faunaTuning": {
        "boar": {
          "sightRange": 42,
          "sightRangeGraze": 26,
          "sightCone": 1.22,
          "hearWalk": 18,
          "hearSprint": 34,
          "noticeRate": 0.65,
          "impactAlert": 28
        }
      },
      "sky": {
        "sunColor": [
          1,
          0.97,
          0.9
        ],
        "sunIntensity": 2.7,
        "envIntensity": 0.7,
        "bgIntensity": 1,
        "fogSunColor": [
          1,
          0.98,
          0.92
        ],
        "cloudSunColor": [
          1,
          0.98,
          0.94
        ],
        "hemiSky": 8098036,
        "hemiGround": 14198904,
        "hemiIntensity": 0.9,
        "planet": {
          "azimuth": 36,
          "elevation": 38,
          "size": 17,
          "tilt": 24,
          "roll": -16
        }
      },
      "atmosphere": {
        "fogHeight": -20,
        "fogHeightFalloff": 0.08,
        "fogHeightDensity": 0.0004,
        "fogDistDensity": 0.00014,
        "volumetricSunColor": [
          1,
          0.97,
          0.9
        ]
      },
      "grade": {
        "saturation": 0.3,
        "brightness": 0,
        "contrast": 0.2,
        "bloomIntensity": 0.4,
        "bloomThreshold": 1,
        "shadowTint": [
          0.94,
          0.98,
          1.06
        ],
        "highTint": [
          1.04,
          1.01,
          0.96
        ],
        "lift": [
          0,
          0,
          0.005
        ],
        "gain": [
          1.02,
          1.02,
          1
        ],
        "gamma": 1
      },
      "spawn": {
        "x": 0,
        "y": 1.2,
        "z": -194,
        "yaw": 3.141592653589793
      }
    },
    "terrain": [
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": 0.8,
        "stream": null
      },
      {
        "height": 6.2,
        "normal": [
          -0.05747446770672558,
          0.99669121152123,
          -0.05747446770672558
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 16.179056173463433,
        "cabin": 0,
        "pond": 0,
        "water": 0.8,
        "stream": null
      },
      {
        "height": 6.125970970771922,
        "normal": [
          0.016225087642752167,
          0.9997993405562683,
          -0.011748410711077689
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 39.201029300955405,
        "cabin": 0,
        "pond": 0,
        "water": 0.8,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": 0.8,
        "stream": null
      }
    ]
  },
  {
    "data": {
      "id": "chunk://local/pine-hollow",
      "slug": "pine-hollow",
      "displayName": "Pine Hollow",
      "gridCoords": "(+3, −2)",
      "seed": 1337,
      "treeCount": 2600,
      "accent": "moss",
      "biome": "Boreal pine forest",
      "earlyAccess": true,
      "blurb": "A photoreal boreal forest, from dawn fog to lantern-lit night. Hunt deer, boar, elk and bear through the pines, relight the ranger's three dark waystone lanterns and face the Antler King in the old-growth — his thralls walk the fog until dawn.",
      "thumbnail": "/src/chunks/thumbs/pine-hollow.jpg",
      "heroPortrait": "/src/chunks/thumbs/pine-hollow-portrait.jpg",
      "heroLandscape": "/src/chunks/thumbs/pine-hollow-landscape.jpg",
      "explore": true,
      "roster": "@function",
      "pois": [
        {
          "id": "gate",
          "name": "South gate",
          "x": 0,
          "z": -215,
          "r": 18
        },
        {
          "id": "crossroads",
          "name": "Crossroads",
          "x": 0,
          "z": -10,
          "r": 16
        },
        {
          "id": "cabin-1",
          "name": "Ranger's cabin",
          "x": -14,
          "z": -34,
          "r": 12
        },
        {
          "id": "cabin-2",
          "name": "West cabin",
          "x": 62,
          "z": 30,
          "r": 12
        },
        {
          "id": "cabin-3",
          "name": "Ridge cabin",
          "x": 118,
          "z": 142,
          "r": 12
        },
        {
          "id": "zipline",
          "name": "Zipline landing",
          "x": 4,
          "z": 20,
          "r": 10
        },
        {
          "id": "lookout",
          "name": "Fire lookout",
          "x": 36,
          "z": 214,
          "r": 16
        },
        {
          "id": "pond",
          "name": "Still pond",
          "x": -100,
          "z": 110,
          "r": 36
        },
        {
          "id": "waterfall",
          "name": "Waterfall",
          "x": -88,
          "z": 150,
          "r": 18
        },
        {
          "id": "islet",
          "name": "The islet",
          "x": -94,
          "z": 118,
          "r": 10
        },
        {
          "id": "dam",
          "name": "Beaver dam",
          "x": -138,
          "z": 64,
          "r": 10
        },
        {
          "id": "bridge",
          "name": "Creek bridge",
          "x": -151,
          "z": -3,
          "r": 10
        },
        {
          "id": "den",
          "name": "The Den",
          "x": 190,
          "z": 186,
          "r": 26
        },
        {
          "id": "cave",
          "name": "Bear cave",
          "x": 200,
          "z": 200,
          "r": 12
        },
        {
          "id": "clearing",
          "name": "King's clearing",
          "x": 150,
          "z": -30,
          "r": 34
        },
        {
          "id": "hamlet",
          "name": "Mill hamlet",
          "x": -150,
          "z": -138,
          "r": 40
        },
        {
          "id": "lodge",
          "name": "Hunting lodge",
          "x": -162,
          "z": -118,
          "r": 12
        },
        {
          "id": "mill",
          "name": "Watermill",
          "x": -181,
          "z": -144,
          "r": 12
        }
      ],
      "terrain": {
        "heightAt": "@function",
        "normalAt": "@function",
        "trailDistance": "@function",
        "cabinMask": "@function",
        "pondMask": "@function",
        "waterLevel": "@function",
        "streamAt": "@function",
        "splatAt": "@function",
        "trails": [
          [
            [
              0,
              -250
            ],
            [
              0,
              -190
            ],
            [
              -8,
              -150
            ],
            [
              -30,
              -95
            ],
            [
              -22,
              -40
            ],
            [
              0,
              -10
            ]
          ],
          [
            [
              0,
              250
            ],
            [
              0,
              190
            ],
            [
              -2,
              160
            ],
            [
              2,
              118
            ],
            [
              4,
              70
            ],
            [
              4,
              20
            ],
            [
              0,
              -10
            ]
          ],
          [
            [
              250,
              0
            ],
            [
              190,
              0
            ],
            [
              162,
              6
            ],
            [
              120,
              12
            ],
            [
              84,
              16
            ],
            [
              58,
              12
            ],
            [
              28,
              -2
            ],
            [
              0,
              -10
            ]
          ],
          [
            [
              -250,
              0
            ],
            [
              -190,
              0
            ],
            [
              -151,
              -3
            ],
            [
              -112,
              -12
            ],
            [
              -62,
              -18
            ],
            [
              -30,
              -14
            ],
            [
              0,
              -10
            ]
          ],
          [
            [
              4,
              72
            ],
            [
              40,
              94
            ],
            [
              82,
              116
            ],
            [
              104,
              124
            ],
            [
              126,
              128
            ],
            [
              150,
              142
            ],
            [
              168,
              158
            ]
          ],
          [
            [
              162,
              6
            ],
            [
              156,
              -4
            ]
          ],
          [
            [
              4,
              76
            ],
            [
              -30,
              86
            ],
            [
              -60,
              98
            ],
            [
              -63,
              116
            ],
            [
              -68,
              134
            ],
            [
              -78,
              148
            ]
          ],
          [
            [
              -112,
              -12
            ],
            [
              -128,
              -50
            ],
            [
              -140,
              -88
            ],
            [
              -148,
              -116
            ]
          ],
          [
            [
              -14,
              -122
            ],
            [
              -58,
              -130
            ],
            [
              -100,
              -138
            ],
            [
              -128,
              -138
            ]
          ],
          [
            [
              112,
              125
            ],
            [
              114,
              132
            ]
          ],
          [
            [
              150,
              142
            ],
            [
              146,
              158
            ],
            [
              110,
              178
            ],
            [
              76,
              196
            ],
            [
              36,
              214
            ]
          ]
        ],
        "cabinSites": [
          {
            "x": -14,
            "z": -34,
            "rot": 0.35
          },
          {
            "x": 62,
            "z": 30,
            "rot": -1.1
          },
          {
            "x": 118,
            "z": 142,
            "rot": 2.4
          }
        ],
        "pond": {
          "x": -100,
          "z": 110,
          "r": 30
        }
      },
      "assets": {
        "groundLayers": [
          "forrest_ground_03",
          "leafy_grass",
          "rock_ground",
          "stony_dirt_path"
        ],
        "groundTints": [
          [
            0.86,
            0.78,
            0.68
          ],
          [
            0.72,
            0.8,
            0.6
          ],
          [
            1,
            0.98,
            0.94
          ],
          [
            0.95,
            0.8,
            0.6
          ]
        ],
        "slabRock": "rock_ground",
        "boreal": {
          "normalK": [
            1.2,
            1,
            1.4,
            1.1
          ],
          "trailDust": [
            1.25,
            1.02,
            0.7,
            0.6
          ],
          "grassTint": [
            0.8,
            0.74,
            0.55
          ]
        }
      },
      "trees": {
        "factory": "pine",
        "bark": "pine_bark",
        "twigAtlas": "pine_tree_01",
        "noun": "trees",
        "set": "pine-hollow-trees",
        "drawnBy": "model"
      },
      "forest": {
        "spacing": 8.5,
        "densityFreq": 0.008,
        "clearings": [
          -0.45,
          0.35
        ],
        "maxSlope": 0.72,
        "tintHue": 0.25,
        "tintHueJitter": [
          -0.04,
          0.03
        ],
        "tintSat": [
          0.25,
          0.5
        ],
        "tintLight": [
          0.5,
          0.68
        ],
        "largeVariantChance": 0.1,
        "density": "@function",
        "scale": "@function",
        "species": "@function",
        "understory": {
          "ferns": 1,
          "shrubs": 2.5,
          "fernCanopy": false
        }
      },
      "fauna": [
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -237,
            "z": -232,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            174
          ]
        },
        {
          "kind": "elk",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -156,
            "z": -227,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            123
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": -127,
            "z": -221,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            113
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": 62,
            "z": -234,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            92
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 110,
            "z": -218,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            141
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 219,
            "z": -235,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            250
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -218,
            "z": -159,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            113
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -45,
            "z": -180,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            73
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -1,
            "z": -157,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            40
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 51,
            "z": -158,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            87
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 97,
            "z": -179,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            128
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 178,
            "z": -163,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            191
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": 225,
            "z": -159,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            189
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -229,
            "z": -120,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            111
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -115,
            "z": -101,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            59
          ]
        },
        {
          "kind": "elk",
          "count": 2,
          "canopy": false,
          "anchor": {
            "x": -56,
            "z": -103,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            57
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 2,
            "z": -106,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            53
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 65,
            "z": -110,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            110
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": 160,
            "z": -103,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            129
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 225,
            "z": -124,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            154
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -235,
            "z": -70,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            101
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -154,
            "z": -57,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            54
          ]
        },
        {
          "kind": "elk",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -104,
            "z": -59,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            56
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -70,
            "z": -56,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            69
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": 61,
            "z": -66,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            103
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": 109,
            "z": -58,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            102
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 213,
            "z": -67,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            97
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -210,
            "z": 1,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            32
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -164,
            "z": 0,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            33
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -97,
            "z": -3,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            41
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -59,
            "z": -3,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            45
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 13,
            "z": 9,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            40
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 51,
            "z": -4,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            42
          ]
        },
        {
          "kind": "elk",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 100,
            "z": -3,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            48
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 233,
            "z": -9,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            40
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": -224,
            "z": 70,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            100
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": -107,
            "z": 44,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            86
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -57,
            "z": 49,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            75
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 13,
            "z": 65,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            40
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 125,
            "z": 64,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            83
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": 170,
            "z": 46,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            71
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": 229,
            "z": 63,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            93
          ]
        },
        {
          "kind": "elk",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": -176,
            "z": 108,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            136
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -45,
            "z": 105,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            42
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": -13,
            "z": 101,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            46
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 63,
            "z": 114,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            40
          ]
        },
        {
          "kind": "elk",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 161,
            "z": 122,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            15,
            53
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": 225,
            "z": 103,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            109
          ]
        },
        {
          "kind": "deer",
          "count": 3,
          "canopy": false,
          "anchor": {
            "x": -236,
            "z": 159,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            188
          ]
        },
        {
          "kind": "boar",
          "count": 2,
          "canopy": true,
          "anchor": {
            "x": -176,
            "z": 165,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            130
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": -42,
            "z": 176,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            71
          ]
        },
        {
          "kind": "boar",
          "count": 3,
          "canopy": true,
          "anchor": {
            "x": 13,
            "z": 155,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            12,
            45
          ]
        },
        {
          "kind": "deer",
          "count": 4,
          "canopy": false,
          "anchor": {
            "x": 58,
            "z": 170,
            "rMin": 0,
            "rMax": 20
          },
          "trailBand": [
            10,
            61
          ]
        },
        {
          "kind": "bear",
          "count": 2,
          "anchor": {
            "x": 196,
            "z": 192,
            "rMin": 0,
            "rMax": 10
          },
          "canopy": false,
          "trailBand": [
            18,
            220
          ],
          "variants": [
            "black",
            "black-blaze",
            "black-old"
          ]
        },
        {
          "kind": "bear",
          "count": 1,
          "anchor": {
            "x": 182,
            "z": 172,
            "rMin": 0,
            "rMax": 10
          },
          "canopy": false,
          "trailBand": [
            18,
            220
          ],
          "variants": [
            "brown",
            "brown-old"
          ]
        }
      ],
      "sky": {
        "hdri": "qwantani_sunset_puresky",
        "sunColor": [
          1,
          0.76,
          0.5
        ],
        "sunIntensity": 3.8,
        "envIntensity": 1.1,
        "bgIntensity": 0.95,
        "fogSunColor": [
          1,
          0.78,
          0.5
        ],
        "cloudSunColor": [
          1,
          0.82,
          0.62
        ],
        "hemiSky": 9414864,
        "hemiGround": 4864552,
        "hemiIntensity": 0.45
      },
      "atmosphere": {
        "fogHeight": -14,
        "fogHeightFalloff": 0.12,
        "fogHeightDensity": 0.005,
        "fogDistDensity": 0.00045,
        "volumetricSunColor": [
          1,
          0.72,
          0.42
        ]
      },
      "grade": {
        "saturation": 0.18,
        "brightness": -0.015,
        "contrast": 0.2,
        "bloomIntensity": 0.55,
        "bloomThreshold": 0.85,
        "shadowTint": [
          0.9,
          0.95,
          1.08
        ],
        "highTint": [
          1.06,
          1,
          0.92
        ],
        "lift": [
          -0.01,
          -0.008,
          0
        ],
        "gain": [
          1.03,
          1.02,
          1
        ],
        "gamma": 1
      },
      "look": {
        "grade": {
          "shadowTint": [
            0.95,
            0.97,
            1.03
          ]
        },
        "curve": 0.2,
        "vibrance": 0.2,
        "vol": 0.5,
        "fogDist": 0.55,
        "sat": 0.04,
        "dayMist": 0.25,
        "ambient": 1.3,
        "sky": 1.18
      },
      "spawn": {
        "x": 0,
        "z": -235,
        "yaw": 3.141592653589793
      },
      "pondClip": "@function"
    },
    "terrain": [
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          0,
          0,
          0,
          1
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -3,
        "stream": null
      },
      {
        "height": 0.06199595618943937,
        "normal": [
          0.4590561634656602,
          0.8882029470313593,
          0.01905160541784332
        ],
        "splat": [
          0,
          0,
          0,
          1
        ],
        "trail": 1.3216372009101793,
        "cabin": 0,
        "pond": 0,
        "water": -3,
        "stream": null
      },
      {
        "height": 2.952815591734339,
        "normal": [
          0.19078016664868666,
          0.9579191783617776,
          -0.21446159502390166
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 53.98030041014909,
        "cabin": 0,
        "pond": 0,
        "water": -3,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          0,
          0,
          0,
          1
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -3,
        "stream": null
      }
    ]
  },
  {
    "data": {
      "id": "chunk://local/nalati-grasslands",
      "slug": "nalati-grasslands",
      "displayName": "Nalati Grasslands",
      "gridCoords": "(+4, −2)",
      "seed": 18970,
      "treeCount": 1400,
      "accent": "ember",
      "biome": "Alpine steppe",
      "earlyAccess": true,
      "blurb": "SUPER EXPERIMENTAL — the Tian Shan steppe, painted: cross the braided Kunes, tame a steppe horse and hunt wolves from the saddle across the golden bowl of the Sky Grassland, break the Golden King in his kurgan, and ride out a storm to face the Storm Titan. Snow Lotus Valley waits in the snow ring. Built live, rough edges everywhere.",
      "thumbnail": "/src/chunks/thumbs/nalati-grasslands.jpg",
      "heroPortrait": "/src/chunks/thumbs/nalati-grasslands-portrait.jpg",
      "heroLandscape": "/src/chunks/thumbs/nalati-grasslands-landscape.jpg",
      "style": "painterly",
      "explore": true,
      "roster": "@function",
      "pois": [
        {
          "id": "nomad-camp",
          "name": "Nomad camp",
          "x": 88,
          "z": 212,
          "r": 24
        },
        {
          "id": "sheep-pasture",
          "name": "Sheep pasture",
          "x": -120,
          "z": 212,
          "r": 24
        },
        {
          "id": "bridge",
          "name": "Bridge",
          "x": 0,
          "z": 172,
          "r": 24
        },
        {
          "id": "kunes-river",
          "name": "Kunes river",
          "x": 150,
          "z": 170.69679046771836,
          "r": 24
        },
        {
          "id": "sky-road",
          "name": "Sky road",
          "x": 46,
          "z": 128,
          "r": 24
        },
        {
          "id": "eagle-rock",
          "name": "Eagle rock",
          "x": 180,
          "z": 85,
          "r": 24
        },
        {
          "id": "horse-plains",
          "name": "Horse plains",
          "x": 65,
          "z": 36,
          "r": 24
        },
        {
          "id": "kokpar-field",
          "name": "Kokpar field",
          "x": -61,
          "z": 36,
          "r": 24
        },
        {
          "id": "kurgan-field",
          "name": "Kurgan field",
          "x": -106,
          "z": 83,
          "r": 24
        },
        {
          "id": "great-kurgan",
          "name": "Great kurgan",
          "x": -191,
          "z": 75,
          "r": 24
        },
        {
          "id": "summer-camp",
          "name": "Summer camp",
          "x": -91,
          "z": -26,
          "r": 24
        },
        {
          "id": "watchtower",
          "name": "Watchtower",
          "x": -208,
          "z": -38,
          "r": 24
        },
        {
          "id": "wind-cairn",
          "name": "Wind cairn",
          "x": -30,
          "z": -45,
          "r": 24
        },
        {
          "id": "glacier",
          "name": "Glacier",
          "x": -82,
          "z": -81,
          "r": 24
        },
        {
          "id": "snow-leopard-cave",
          "name": "Snow leopard cave",
          "x": 138,
          "z": -68,
          "r": 24
        },
        {
          "id": "the-crags",
          "name": "The crags",
          "x": -180,
          "z": -115,
          "r": 24
        },
        {
          "id": "snow-lotus",
          "name": "Snow lotus",
          "x": 143,
          "z": -136,
          "r": 24
        }
      ],
      "hud": {
        "dayBadge": true
      },
      "weapon": "nalati",
      "horizon": {
        "cloudSea": true,
        "rings": [
          {
            "r": 800,
            "base": -95,
            "floor": -95,
            "color": [
              0.16,
              0.3,
              0.06
            ],
            "top": [
              0.36,
              0.46,
              0.11
            ],
            "snowLine": 2,
            "haze": 0.06,
            "bands": [
              {
                "azimuth": 0,
                "spread": 60,
                "height": 40,
                "rough": 0.05
              },
              {
                "azimuth": 300,
                "spread": 45,
                "height": 20,
                "rough": 0
              },
              {
                "azimuth": 90,
                "spread": 45,
                "height": 145,
                "rough": 0.3
              },
              {
                "azimuth": 140,
                "spread": 30,
                "height": 165,
                "rough": 0.35
              },
              {
                "azimuth": 190,
                "spread": 40,
                "height": 130,
                "rough": 0.25
              },
              {
                "azimuth": 240,
                "spread": 25,
                "height": 75,
                "rough": 0.12
              }
            ]
          },
          {
            "r": 1400,
            "base": -150,
            "floor": -150,
            "color": [
              0.08,
              0.14,
              0.06
            ],
            "top": [
              0.22,
              0.27,
              0.13
            ],
            "snowLine": 0.9,
            "haze": 0.12,
            "bands": [
              {
                "azimuth": 20,
                "spread": 50,
                "height": 70,
                "rough": 0.3
              },
              {
                "azimuth": 290,
                "spread": 50,
                "height": 35,
                "rough": 0.1
              },
              {
                "azimuth": 95,
                "spread": 40,
                "height": 330,
                "rough": 0.6
              },
              {
                "azimuth": 150,
                "spread": 40,
                "height": 360,
                "rough": 0.6
              },
              {
                "azimuth": 205,
                "spread": 35,
                "height": 280,
                "rough": 0.5
              }
            ]
          }
        ]
      },
      "groundColor": "@function",
      "surfaceAt": "@function",
      "terrain": {
        "heightAt": "@function",
        "normalAt": "@function",
        "trailDistance": "@function",
        "cabinMask": "@function",
        "pondMask": "@function",
        "waterLevel": "@function",
        "splatAt": "@function",
        "trails": [
          [
            [
              0,
              -250
            ],
            [
              0,
              -190
            ],
            [
              -4,
              -150
            ],
            [
              -2,
              -110
            ],
            [
              4,
              -76
            ],
            [
              2,
              -50
            ],
            [
              0,
              -20
            ],
            [
              6,
              12
            ]
          ],
          [
            [
              0,
              250
            ],
            [
              0,
              190
            ],
            [
              0,
              156
            ]
          ],
          [
            [
              -250,
              0
            ],
            [
              -190,
              0
            ],
            [
              -166,
              16
            ],
            [
              -142,
              42
            ],
            [
              -118,
              66
            ]
          ],
          [
            [
              250,
              0
            ],
            [
              190,
              0
            ],
            [
              165,
              12
            ],
            [
              140,
              40
            ],
            [
              120,
              70
            ]
          ],
          [
            [
              0,
              156
            ],
            [
              4,
              147
            ],
            [
              56,
              141
            ],
            [
              60,
              133
            ],
            [
              8,
              126
            ],
            [
              4,
              118
            ],
            [
              56,
              111
            ],
            [
              60,
              103
            ],
            [
              12,
              96
            ],
            [
              10,
              88
            ],
            [
              44,
              82
            ],
            [
              70,
              78
            ],
            [
              96,
              74
            ],
            [
              120,
              70
            ]
          ],
          [
            [
              0,
              214
            ],
            [
              40,
              218
            ],
            [
              62,
              215.5
            ],
            [
              74,
              206.5
            ]
          ],
          [
            [
              120,
              70
            ],
            [
              86,
              54
            ],
            [
              34,
              40
            ],
            [
              -26,
              38
            ]
          ],
          [
            [
              6,
              12
            ],
            [
              -30,
              26
            ]
          ],
          [
            [
              -96,
              42
            ],
            [
              -104,
              60
            ]
          ],
          [
            [
              147,
              33
            ],
            [
              180,
              44
            ],
            [
              198,
              58
            ],
            [
              196,
              70
            ],
            [
              188,
              73.8
            ],
            [
              178,
              73.4
            ],
            [
              171.5,
              77.5
            ]
          ],
          [
            [
              140,
              -40
            ],
            [
              122,
              -48
            ],
            [
              121,
              -64
            ],
            [
              127,
              -71
            ],
            [
              132,
              -73.5
            ],
            [
              137,
              -73
            ]
          ],
          [
            [
              -166,
              -32
            ],
            [
              -192,
              -42
            ],
            [
              -168,
              -52
            ],
            [
              -160,
              -60
            ],
            [
              -156,
              -67
            ]
          ]
        ],
        "cabinSites": [],
        "pond": null
      },
      "assets": {
        "groundLayers": [
          "leafy_grass",
          "stony_dirt_path",
          "rock_ground",
          "forest_ground_04"
        ],
        "groundTints": [
          [
            0.7,
            0.85,
            0.5
          ],
          [
            0.9,
            0.84,
            0.66
          ],
          [
            0.7,
            0.7,
            0.72
          ],
          [
            0.95,
            0.95,
            0.95
          ]
        ],
        "slabRock": "rock_ground"
      },
      "trees": {
        "factory": "spruce",
        "bark": "pine_bark",
        "twigAtlas": "pine_tree_01",
        "noun": "spruces"
      },
      "forest": {
        "spacing": 4.2,
        "densityFreq": 0.01,
        "clearings": [
          -2,
          -1.5
        ],
        "maxSlope": 0.6,
        "tintHue": 0.3,
        "tintHueJitter": [
          -0.06,
          0.06
        ],
        "tintSat": [
          0.05,
          0.25
        ],
        "tintLight": [
          0.8,
          0.95
        ],
        "largeVariantChance": 0.15,
        "mask": "@function"
      },
      "fauna": [],
      "sky": {
        "hdri": "kloofendal_48d_partly_cloudy_puresky",
        "painted": {
          "zenith": [
            0.1,
            0.28,
            0.85
          ],
          "horizon": [
            0.62,
            0.78,
            0.98
          ],
          "ground": [
            0.3,
            0.36,
            0.3
          ],
          "glow": [
            0.5,
            0.4,
            0.25
          ]
        },
        "sun": {
          "azimuth": 250,
          "elevation": 26
        },
        "sunColor": [
          1,
          0.85,
          0.64
        ],
        "sunIntensity": 2.8,
        "envIntensity": 0.6,
        "bgIntensity": 1,
        "fogSunColor": [
          1,
          0.88,
          0.7
        ],
        "cloudSunColor": [
          1,
          0.93,
          0.82
        ],
        "hemiSky": 10274047,
        "hemiGround": 8025142,
        "hemiIntensity": 0.5,
        "planet": {
          "azimuth": 205,
          "elevation": 23,
          "size": 26,
          "tilt": 2,
          "roll": -20
        }
      },
      "atmosphere": {
        "fogHeight": -30,
        "fogHeightFalloff": 0.05,
        "fogHeightDensity": 0.0006,
        "fogDistDensity": 0.002,
        "volumetricSunColor": [
          1,
          0.9,
          0.72
        ],
        "volumetric": {
          "height": -30,
          "falloff": 0.06,
          "density": 0.0009,
          "strength": 0.35
        }
      },
      "grade": {
        "saturation": 0.1,
        "brightness": 0,
        "contrast": 0.15,
        "bloomIntensity": 0.35,
        "bloomThreshold": 0.86,
        "shadowTint": [
          0.9,
          0.96,
          1.1
        ],
        "highTint": [
          1.05,
          1.01,
          0.94
        ],
        "lift": [
          0,
          0.004,
          0.018
        ],
        "gain": [
          1.02,
          1.02,
          1
        ],
        "gamma": 1
      },
      "spawn": {
        "x": 0,
        "z": 232,
        "yaw": 0
      }
    },
    "terrain": [
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          9.999000099990002e-05,
          0.9999000099990001,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -10,
        "stream": null
      },
      {
        "height": 25.556584376686153,
        "normal": [
          0.21084309503323295,
          0.9756558659828182,
          0.06033921154708764
        ],
        "splat": [
          0.8077925933147365,
          0.1922074066852635,
          0,
          0
        ],
        "trail": 3.6857707010037073,
        "cabin": 0,
        "pond": 0,
        "water": -10,
        "stream": null
      },
      {
        "height": 35.73411458536477,
        "normal": [
          0.15101259924515167,
          0.8899027573856183,
          0.43042801635894534
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 47.67598976424087,
        "cabin": 0,
        "pond": 0,
        "water": -10,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          9.999000099990002e-05,
          0.9999000099990001,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -10,
        "stream": null
      }
    ]
  },
  {
    "data": {
      "id": "chunk://local/nine-dragon-stack",
      "pois": [
        { "id": "lantern-square", "name": "Lantern square", "x": 11, "z": -3, "r": 16 },
        { "id": "night-market", "name": "Night market", "x": 19, "z": -17, "r": 6 },
        { "id": "stair-street", "name": "Stair-street", "x": 46, "z": 6, "r": 24 },
        { "id": "well-rim", "name": "The well rim", "x": -14, "z": -14, "r": 18 },
        { "id": "portal-north", "name": "Road portal", "x": 0, "z": 236, "r": 8 },
        { "id": "portal-east", "name": "Road portal", "x": 236, "z": 0, "r": 8 },
        { "id": "portal-south", "name": "Road portal", "x": 0, "z": -236, "r": 8 },
        { "id": "portal-west", "name": "Road portal", "x": -236, "z": 0, "r": 8 }
      ],
      "slug": "nine-dragon-stack",
      "displayName": "Nine Dragon Stack",
      "gridCoords": "(−2, +1)",
      "seed": 40234,
      "treeCount": 0,
      "accent": "iris",
      "biome": "Vertical neon city",
      "blurb": "Lantern Square, halfway up a city stacked 500 m high: wet granite, a cinnabar gate, neon calligraphy and the Yamen Well dropping away into silk fog. A prototype fragment — the square, the Well's rim and the stair-street — rough edges everywhere.",
      "experimental": true,
      "thumbnail": "/src/chunks/thumbs/nine-dragon-stack.jpg",
      "heroPortrait": "/src/chunks/thumbs/nine-dragon-stack-portrait.jpg",
      "heroLandscape": "/src/chunks/thumbs/nine-dragon-stack-landscape.jpg",
      "terrain": {
        "heightAt": "@function",
        "normalAt": "@function",
        "trailDistance": "@function",
        "cabinMask": "@function",
        "pondMask": "@function",
        "waterLevel": "@function",
        "splatAt": "@function",
        "trails": [
          [
            [
              0,
              -250
            ],
            [
              0,
              -190
            ]
          ],
          [
            [
              0,
              250
            ],
            [
              0,
              190
            ]
          ],
          [
            [
              -250,
              0
            ],
            [
              -190,
              0
            ]
          ],
          [
            [
              250,
              0
            ],
            [
              190,
              0
            ]
          ]
        ],
        "cabinSites": [],
        "pond": null
      },
      "assets": {
        "groundLayers": [
          "forest_ground_04",
          "leafy_grass",
          "rock_ground",
          "stony_dirt_path"
        ],
        "groundTints": [
          [
            1,
            1,
            1
          ],
          [
            1,
            1,
            1
          ],
          [
            1,
            1,
            1
          ],
          [
            1,
            1,
            1
          ]
        ],
        "slabRock": "rock_ground"
      },
      "trees": {
        "factory": "none",
        "bark": "pine_bark",
        "twigAtlas": "pine_tree_01",
        "noun": "trees"
      },
      "forest": {
        "spacing": 9,
        "densityFreq": 0.01,
        "clearings": [
          -0.3,
          0.4
        ],
        "maxSlope": 0.7,
        "tintHue": 0.28,
        "tintHueJitter": [
          -0.03,
          0.03
        ],
        "tintSat": [
          0.5,
          0.7
        ],
        "tintLight": [
          0.5,
          0.62
        ],
        "largeVariantChance": 0,
        "density": "@function"
      },
      "fauna": [],
      "sky": {
        "hdri": "kloofendal_48d_partly_cloudy_puresky",
        "painted": {
          "zenith": [
            0.09,
            0.14,
            0.26
          ],
          "horizon": [
            0.36,
            0.44,
            0.58
          ],
          "ground": [
            0.16,
            0.18,
            0.22
          ],
          "glow": [
            0.2,
            0.2,
            0.3
          ]
        },
        "sun": {
          "azimuth": 250,
          "elevation": 8
        },
        "sunColor": [
          0.55,
          0.62,
          0.85
        ],
        "sunIntensity": 0.6,
        "envIntensity": 0.5,
        "bgIntensity": 1,
        "fogSunColor": [
          0.6,
          0.66,
          0.8
        ],
        "cloudSunColor": [
          0.6,
          0.66,
          0.8
        ],
        "hemiSky": 7308968,
        "hemiGround": 2763828,
        "hemiIntensity": 0.5
      },
      "atmosphere": {
        "fogHeight": 85,
        "fogHeightFalloff": 0.05,
        "fogHeightDensity": 0.004,
        "fogDistDensity": 0.004,
        "volumetricSunColor": [
          0.55,
          0.62,
          0.85
        ],
        "volumetric": {
          "height": 95,
          "falloff": 0.05,
          "density": 0.003,
          "strength": 0.3
        }
      },
      "grade": {
        "saturation": 0.1,
        "brightness": 0,
        "contrast": 0.1,
        "bloomIntensity": 0.6,
        "bloomThreshold": 0.9,
        "shadowTint": [
          0.92,
          0.96,
          1.08
        ],
        "highTint": [
          1.06,
          1,
          0.92
        ],
        "lift": [
          0,
          0,
          0.01
        ],
        "gain": [
          1,
          1,
          1
        ],
        "gamma": 1
      },
      "spawn": {
        "x": 0.95,
        "z": 7.5,
        "yaw": -0.20943951023931956,
        "y": 125
      },
      "weapon": "sword",
      "fov": {
        "portrait": 78
      },
      "sword": "@function",
      "horizon": {
        "rings": [],
        "cloudSea": false
      },
      "explore": true,
      "roster": "@function",
      "render": "@function",
      "bounds": {
        "x0": -36,
        "x1": 90,
        "z0": -130,
        "z1": 28,
        "floor": 25
      },
      "structures": {
        "files": [
          "/assets/nine-dragon/paint/concrete.jpg",
          "/assets/nine-dragon/paint/flag.jpg",
          "/assets/nine-dragon/paint/flag-a.jpg",
          "/assets/nine-dragon/paint/flag2.jpg",
          "/assets/nine-dragon/paint/flag2-a.jpg",
          "/assets/nine-dragon/paint/lacquer.jpg",
          "/assets/nine-dragon/paint/panel.jpg",
          "/assets/nine-dragon/paint/poster.jpg",
          "/assets/nine-dragon/paint/poster-a.jpg",
          "/assets/nine-dragon/paint/stone.jpg",
          "/assets/nine-dragon/paint/tiles.jpg",
          "/assets/nine-dragon/paint/wood.jpg",
          "/assets/nine-dragon/baked/layout.bin",
          "/assets/nine-dragon/baked/specimens.bin",
          "/assets/nine-dragon/lab/walker.glb",
          "/assets/nine-dragon/lab/sitter.glb",
          "/assets/nine-dragon/lab/grapple/dragon-hook.glb",
          "/assets/nine-dragon/lab/organic/lion.glb",
          "/assets/nine-dragon/lab/organic/pots.glb",
          "/assets/nine-dragon/lab/organic/lanterns.glb",
          "/assets/nine-dragon/lab/organic/leaf-atlas.webp",
          "/assets/nine-dragon/lab/organic/scroll.webp",
          "/assets/nine-dragon/grade-lut-cleanroom.bin",
          "/assets/nine-dragon/viewmodel/fp-rig.glb",
          "/assets/nine-dragon/viewmodel/hand-r-maps.webp",
          "/assets/nine-dragon/viewmodel/hand-r-nrm.webp",
          "/assets/nine-dragon/viewmodel/arm-r-maps.webp",
          "/assets/nine-dragon/viewmodel/arm-r-nrm.webp",
          "/assets/nine-dragon/viewmodel/fist-l-maps.webp",
          "/assets/nine-dragon/viewmodel/fist-l-nrm.webp",
          "/assets/nine-dragon/viewmodel/gauntlet-maps.webp",
          "/assets/nine-dragon/viewmodel/gauntlet-nrm.webp"
        ],
        "build": "@function"
      }
    },
    "terrain": [
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -10000,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 190,
        "cabin": 0,
        "pond": 0,
        "water": -10000,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 121.75795661885921,
        "cabin": 0,
        "pond": 0,
        "water": -10000,
        "stream": null
      },
      {
        "height": 0,
        "normal": [
          0,
          1,
          0
        ],
        "splat": [
          1,
          0,
          0,
          0
        ],
        "trail": 0,
        "cabin": 0,
        "pond": 0,
        "water": -10000,
        "stream": null
      }
    ]
  }
];

function data(value: unknown): unknown {
  if (typeof value === 'function') return '@function';
  if (Array.isArray(value)) return value.map((item: unknown) => data(item));
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]: [string, unknown]) => [key, data(item)]));
  return value;
}

// Assets moved with their owner; compare their identity in the original source namespace.
function originalArt(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/^\/src\/shards\/([^/]+)\/thumbs\//, '/src/chunks/thumbs/');
}

/** the field less its runtime `datum` (G164), every other own property (getters read) kept */
function withoutDatum(terrain: object): object { return Object.fromEntries(Object.entries(terrain).filter(([key]) => key !== 'datum')); }
function originalShape(m: (typeof SHARDS)[number], fixture: (typeof ORIGINAL)[number]['data']): object {
  const { navmesh: _navmesh, creatures: _creatures, debugOptions: _debugOptions, next: _next, blender: _blender, pondLilyExclusions: _pondLilyExclusions, horizonStrips: _horizonStrips, uses: _uses, loadout: _loadout, budgets: _budgets, audio: _audio, species: _species, encounters: _encounters, bag: _bag, dev: _dev, api: _api, assetGlobs: _assetGlobs, ktx2: _ktx2, kitLook: _kitLook, hands: _hands, load: _load, boot: _boot, tiers: _tiers, name, label, card, ground, spawns, minimap, fight, camera, status, order: _order, render: _render, placement: _placement, explore, runtimeCost: _runtimeCost, gridShardfile: _gridShardfile, trustedRuntime: _trustedRuntime, entries: _entries, ...kept } = m;
  const old = {
    ...kept, id: `chunk://local/${m.slug}`, displayName: name, gridCoords: label,
    thumbnail: originalArt(card.thumb), heroPortrait: originalArt(card.portrait), heroLandscape: originalArt(card.landscape),
    // G164: a runtime vertical shift (`datum`, Driftwood's hybrid row) is not part of the original shape
    terrain: ground.terrain === undefined ? undefined : withoutDatum(ground.terrain), fauna: spawns,
    // G172: the sea shipped lowered with the world, so the original level is the shipped one less the field's datum
    ...(m.ocean === undefined ? {} : { ocean: { ...m.ocean, level: m.ocean.level - (ground.terrain?.datum ?? 0) } }),
    ...(minimap === undefined ? {} : { map: minimap }),
    ...(ground.structures === undefined ? {} : { structures: ground.structures === true ? { files: m.boot?.files('phone'), build: () => undefined } : ground.structures }),
    ...(m.render === undefined || !('render' in fixture) ? {} : { render: m.render }),
    ...(camera === undefined ? {} : { fov: { portrait: camera.portraitFov } }),
    ...(fight?.maxHitDamage === undefined ? {} : { maxHitDamage: fight.maxHitDamage }),
    ...(fight?.capExempt === undefined ? {} : { hitCapExempt: fight.capExempt }),
    ...(fight?.attackers === undefined || fight.attackers === Infinity ? {} : { fightRules: { maxAttackers: fight.attackers } }),
    ...(status === 'experimental' ? { experimental: true } : {}),
    ...(status === 'earlyAccess' ? { earlyAccess: true } : {}),
    ...(explore === undefined ? {} : { explore: true }),
  };
  // F6 makes the former defaults explicit; the old fixture deliberately omits them.
  const projected: Record<string, unknown> = { ...old };
  // S2 turns former Pine-only runtime gates into declared atmosphere policy.
  const { edgeHaze: _edgeHaze, wetSurfaces: _wetSurfaces, ...atmosphere } = m.atmosphere;
  projected['atmosphere'] = atmosphere;
  // The lazy shard factory replaces the historical selector; authored assets stay exact.
  if (typeof m.trees.factory === 'function') projected['trees'] = { ...m.trees, factory: fixture.trees.factory };
  // E405: a tree set's variants and its species' traits moved from the engine into the level's own data.
  if (typeof projected['trees'] === 'object' && projected['trees'] !== null && 'setVariants' in projected['trees']) {
    const { setVariants: _setVariants, ...trees } = projected['trees'] as Record<string, unknown>;
    projected['trees'] = trees;
  }
  if (m.forest?.speciesTraits !== undefined) {
    const { speciesTraits: _speciesTraits, ...forest } = m.forest;
    projected['forest'] = forest;
  }
  // Nalati's palette moved from the engine map into its manifest; SF66 (G246) replaced the registered pieces, the sand paths and
  // the void colour with the map baked from the world (the fixtures dropped them). Other map data stays frozen.
  if (minimap !== undefined) {
    const { palette: _palette, openWater: _openWater, outside: _outside, image: _image, ...map } = minimap;
    if (Object.keys(map).length === 0 && !('map' in fixture)) delete projected['map'];
    else projected['map'] = map;
  }
  if (!('style' in fixture)) delete projected['style'];
  else projected['style'] = m.style === 'toon' ? 'lowpoly' : m.style === 'jiehua' ? 'pbr' : m.style;
  if (m.weapon === 'custom') projected['weapon'] = fixture.weapon;
  if (!('weapon' in fixture)) delete projected['weapon'];
  return projected;
}

describe('ChunkDef → ShardManifest preserves all 48 field mappings', () => {
  it.each(ORIGINAL)('$data.slug retains its authored data, save key, hooks and terrain', (fixture) => {
    const m = SHARDS.find((entry) => entry.slug === fixture.data.slug);
    if (!m) throw new Error(`Missing manifest ${fixture.data.slug}`);
    if (fixture.data.slug === 'pine-hollow' || fixture.data.slug === 'nalati-grasslands') expect(typeof m.trees.factory).toBe('function');
    if (fixture.data.slug === 'pine-hollow') expect(m.blender).toEqual({ area: { x0: -79.41176470588235, x1: 79.41176470588232, z0: -120.58823529411765, z1: 40.19607843137254 }, models: [] });
    if (fixture.data.slug === 'driftwood-isle') expect(m.next).toBe('nalati-grasslands');
    if (fixture.data.slug === 'pine-hollow') expect(m.pondLilyExclusions).toEqual([{ x: -122, z: 86, r: 10 }, { x: -88.3, z: 140, r: 10 }]);
    if (fixture.data.slug === 'pine-hollow') expect(m.horizonStrips).toEqual({
      day: '/assets/horizon/pine-hollow-day.webp', night: '/assets/horizon/pine-hollow-night.webp',
      phone: { day: '/assets/horizon/pine-hollow-day-phone.webp', night: '/assets/horizon/pine-hollow-night-phone.webp' },
      elMin: -30, elMax: 14, scale: 4,
    });
    if (fixture.data.slug === 'nalati-grasslands') {
      expect(typeof m.minimap?.palette?.ground).toBe('function');
      expect(typeof m.minimap?.palette?.overlay).toBe('function');
      expect(typeof m.minimap?.palette?.pois).toBe('function');
    }
    // Former engine branches are explicit policy; check them separately from the frozen original schema.
    const pine = m.slug === 'pine-hollow', island = m.slug === 'driftwood-isle';
    expect(m.creatures).toEqual({ lowPoly: island, waitForModels: pine || m.slug === 'nalati-grasslands', furRim: pine, tintRange: island ? 0.3 : 0.2, oneMaterial: island });
    expect(m.debugOptions).toEqual(m.slug === 'nalati-grasslands' ? [] : []);
    expect(m.fight?.telegraphed).toBe(!pine);
    if (island) {
      expect(m.minimap?.openWater).toEqual({ level: 0, deepDepth: 6 }); // G172: the sea ships lowered 0.8 m (LOWERED_SEA)
      expect(m.minimap?.outside).toBe('rgb(22,74,128)');
    }
    expect(m.label).toBe(fixture.data.gridCoords);
    expect(formatGrid(m.placement.grid)).toBe(m.label);
    expect(m.placement.size).toEqual([500, 500, 500]);
    expect(m.order).toBe(ORIGINAL.indexOf(fixture) + 1);
    expect(m.kitLook).toBe(m.style === 'toon' || m.style === 'painterly' ? m.style : 'pbr');
    expect(m.status).toBe('experimental' in fixture.data ? 'experimental' : 'earlyAccess' in fixture.data ? 'earlyAccess' : 'live');
    expect(`chunk://local/${m.slug}`).toBe(fixture.data.id);
    expect(data(originalShape(m, fixture.data))).toEqual(fixture.data);
    expect(m.explore).toBeDefined();
    for (const [kind, url] of Object.entries(exploreArt(m.explore) ?? {})) expect(url).toContain(`/${kind}-${m.slug}.webp`);
    const t = terrainFor(m);
    const points: readonly (readonly [number, number])[] = [[-250, 0], [0, 0], [75, -40], [0, 250]];
    const datum = t.datum ?? 0; // G172: compare in the authored frame (heights and waterline less the runtime drop)
    expect(points.map(([x, z]) => ({
      height: t.heightAt(x, z) - datum, normal: t.normalAt(x, z), splat: t.splatAt(x, z), trail: t.trailDistance(x, z),
      cabin: t.cabinMask(x, z), pond: t.pondMask(x, z), water: t.waterLevel() - datum, stream: t.streamAt?.(x, z) ?? null,
    }))).toEqual(fixture.terrain);
  });
});

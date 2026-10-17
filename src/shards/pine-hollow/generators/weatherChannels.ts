// Private visual scalar DAGs; native clocks, rain, animals and audio stay with their owners.
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import {parseClientChannels} from '@wildshard/format/clientChannels';

const PINE_WEATHER_CHANNELS = [
  {
    "target": "overcast", "owner": "mod", "path": ["overcast"], "restore": false,
    "program": {
      "id": "pine.weather.overcast",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 0
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 0
        }
      ]
    }
  },
  {
    "target": "fogDist", "owner": "mod", "path": ["fogDist"], "restore": false,
    "program": {
      "id": "pine.weather.fogDist",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 2,
          "b": 3
        },
        {
          "op": "min",
          "a": 0,
          "b": 4
        },
        {
          "op": "sub",
          "a": 0,
          "b": 5
        },
        {
          "op": "mul",
          "a": 1,
          "b": 6
        },
        {
          "op": "constant",
          "value": 2
        },
        {
          "op": "constant",
          "value": 26
        },
        {
          "op": "read",
          "index": 7
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.x
        },
        {
          "op": "sub",
          "a": 10,
          "b": 11
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.ax
        },
        {
          "op": "div",
          "a": 12,
          "b": 13
        },
        {
          "op": "read",
          "index": 8
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.z
        },
        {
          "op": "sub",
          "a": 15,
          "b": 16
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.az
        },
        {
          "op": "div",
          "a": 17,
          "b": 18
        },
        {
          "op": "hypot",
          "a": 14,
          "b": 19
        },
        {
          "op": "neg",
          "a": 20
        },
        {
          "op": "sample",
          "a": 21,
          "interpolation": "smoothstep",
          "keys": [
            [
              -1,
              0
            ],
            [
              -0.72,
              1
            ]
          ]
        },
        {
          "op": "mul",
          "a": 9,
          "b": 22
        },
        {
          "op": "add",
          "a": 8,
          "b": 23
        },
        {
          "op": "mul",
          "a": 7,
          "b": 24
        },
        {
          "op": "add",
          "a": 0,
          "b": 25
        },
        {
          "op": "constant",
          "value": 0.4
        },
        {
          "op": "read",
          "index": 2
        },
        {
          "op": "mul",
          "a": 28,
          "b": 6
        },
        {
          "op": "mul",
          "a": 27,
          "b": 29
        },
        {
          "op": "add",
          "a": 26,
          "b": 30
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 31
        }
      ]
    }
  },
  {
    "target": "fogHeight", "owner": "mod", "path": ["fogHeight"], "restore": false,
    "program": {
      "id": "pine.weather.fogHeight",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 2,
          "b": 3
        },
        {
          "op": "min",
          "a": 0,
          "b": 4
        },
        {
          "op": "sub",
          "a": 0,
          "b": 5
        },
        {
          "op": "mul",
          "a": 1,
          "b": 6
        },
        {
          "op": "constant",
          "value": 1.2
        },
        {
          "op": "constant",
          "value": 1.5
        },
        {
          "op": "read",
          "index": 7
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.x
        },
        {
          "op": "sub",
          "a": 10,
          "b": 11
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.ax
        },
        {
          "op": "div",
          "a": 12,
          "b": 13
        },
        {
          "op": "read",
          "index": 8
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.z
        },
        {
          "op": "sub",
          "a": 15,
          "b": 16
        },
        {
          "op": "constant",
          "value": LAYOUT.OLD_GROWTH.az
        },
        {
          "op": "div",
          "a": 17,
          "b": 18
        },
        {
          "op": "hypot",
          "a": 14,
          "b": 19
        },
        {
          "op": "neg",
          "a": 20
        },
        {
          "op": "sample",
          "a": 21,
          "interpolation": "smoothstep",
          "keys": [
            [
              -1,
              0
            ],
            [
              -0.72,
              1
            ]
          ]
        },
        {
          "op": "mul",
          "a": 9,
          "b": 22
        },
        {
          "op": "add",
          "a": 8,
          "b": 23
        },
        {
          "op": "mul",
          "a": 7,
          "b": 24
        },
        {
          "op": "add",
          "a": 0,
          "b": 25
        },
        {
          "op": "constant",
          "value": 0.6
        },
        {
          "op": "read",
          "index": 2
        },
        {
          "op": "mul",
          "a": 28,
          "b": 6
        },
        {
          "op": "mul",
          "a": 27,
          "b": 29
        },
        {
          "op": "add",
          "a": 26,
          "b": 30
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 31
        }
      ]
    }
  },
  {
    "target": "mist", "owner": "mod", "path": ["mist"], "restore": false,
    "program": {
      "id": "pine.weather.mist",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 2,
          "b": 3
        },
        {
          "op": "min",
          "a": 1,
          "b": 4
        },
        {
          "op": "sub",
          "a": 1,
          "b": 5
        },
        {
          "op": "mul",
          "a": 0,
          "b": 6
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 7
        }
      ]
    }
  },
  {
    "target": "height", "owner": "fog", "path": ["fogHeight", "value"], "restore": true,
    "program": {
      "id": "pine.weather.height",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 9
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "sub",
          "a": 1,
          "b": 0
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 1,
          "b": 5
        },
        {
          "op": "min",
          "a": 4,
          "b": 6
        },
        {
          "op": "sub",
          "a": 4,
          "b": 7
        },
        {
          "op": "mul",
          "a": 3,
          "b": 8
        },
        {
          "op": "mul",
          "a": 2,
          "b": 9
        },
        {
          "op": "add",
          "a": 0,
          "b": 10
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 11
        }
      ]
    }
  },
  {
    "target": "falloff", "owner": "fog", "path": ["fogHeightFalloff", "value"], "restore": true,
    "program": {
      "id": "pine.weather.falloff",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 10
        },
        {
          "op": "constant",
          "value": 0.23
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 4,
          "b": 5
        },
        {
          "op": "min",
          "a": 3,
          "b": 6
        },
        {
          "op": "sub",
          "a": 3,
          "b": 7
        },
        {
          "op": "mul",
          "a": 2,
          "b": 8
        },
        {
          "op": "mul",
          "a": 1,
          "b": 9
        },
        {
          "op": "add",
          "a": 0,
          "b": 10
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 11
        }
      ]
    }
  },
  {
    "target": "volumeHeight", "owner": "volume", "path": ["height"], "restore": true,
    "program": {
      "id": "pine.weather.volumeHeight",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 9
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 0
        }
      ]
    }
  },
  {
    "target": "volumeFalloff", "owner": "volume", "path": ["falloff"], "restore": true,
    "program": {
      "id": "pine.weather.volumeFalloff",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 10
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 0
        }
      ]
    }
  },
  {
    "target": "veilX", "owner": "veil", "path": ["x", "value"], "restore": false,
    "program": {
      "id": "pine.weather.veilX",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "constant",
          "value": 0.7
        },
        {
          "op": "read",
          "index": 0
        },
        {
          "op": "mul",
          "a": 0,
          "b": 1
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 2
        }
      ]
    }
  },
  {
    "target": "veilY", "owner": "veil", "path": ["y", "value"], "restore": false,
    "program": {
      "id": "pine.weather.veilY",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "constant",
          "value": 0.75
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 3,
          "b": 4
        },
        {
          "op": "min",
          "a": 2,
          "b": 5
        },
        {
          "op": "sub",
          "a": 2,
          "b": 6
        },
        {
          "op": "mul",
          "a": 1,
          "b": 7
        },
        {
          "op": "mul",
          "a": 0,
          "b": 8
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 9
        }
      ]
    }
  },
  {
    "target": "mistOpacity", "owner": "particles", "path": ["mistOpacity"], "restore": true,
    "program": {
      "id": "pine.weather.mistOpacity",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 11
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "constant",
          "value": 1.6
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 4,
          "b": 5
        },
        {
          "op": "min",
          "a": 1,
          "b": 6
        },
        {
          "op": "sub",
          "a": 1,
          "b": 7
        },
        {
          "op": "mul",
          "a": 3,
          "b": 8
        },
        {
          "op": "mul",
          "a": 2,
          "b": 9
        },
        {
          "op": "add",
          "a": 1,
          "b": 10
        },
        {
          "op": "mul",
          "a": 0,
          "b": 11
        },
        {
          "op": "constant",
          "value": 0.5
        },
        {
          "op": "read",
          "index": 2
        },
        {
          "op": "mul",
          "a": 13,
          "b": 14
        },
        {
          "op": "sub",
          "a": 1,
          "b": 15
        },
        {
          "op": "mul",
          "a": 12,
          "b": 16
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 17
        }
      ]
    }
  },
  {
    "target": "wet", "owner": "weather", "path": ["uWet", "value"], "restore": true,
    "program": {
      "id": "pine.weather.wet",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 12
        },
        {
          "op": "constant",
          "value": 0
        },
        {
          "op": "read",
          "index": 3
        },
        {
          "op": "constant",
          "value": 0.22
        },
        {
          "op": "read",
          "index": 1
        },
        {
          "op": "constant",
          "value": 1
        },
        {
          "op": "read",
          "index": 6
        },
        {
          "op": "max",
          "a": 1,
          "b": 6
        },
        {
          "op": "min",
          "a": 5,
          "b": 7
        },
        {
          "op": "sub",
          "a": 5,
          "b": 8
        },
        {
          "op": "mul",
          "a": 4,
          "b": 9
        },
        {
          "op": "mul",
          "a": 3,
          "b": 10
        },
        {
          "op": "max",
          "a": 2,
          "b": 11
        },
        {
          "op": "select",
          "test": 0,
          "yes": 1,
          "no": 12
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 13
        }
      ]
    }
  },
  {
    "target": "rain", "owner": "water", "path": ["uRainRings", "value"], "restore": true,
    "program": {
      "id": "pine.weather.rain",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 2
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 0
        }
      ]
    }
  },
  {
    "target": "wind", "owner": "wind", "path": ["value"], "restore": true,
    "program": {
      "id": "pine.weather.wind",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 4
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 0
        }
      ]
    }
  },
  {
    "target": "windX", "owner": "windVector", "path": ["x"], "restore": false,
    "program": {
      "id": "pine.weather.windX",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 13
        },
        {
          "op": "constant",
          "value": 3
        },
        {
          "op": "constant",
          "value": 7
        },
        {
          "op": "read",
          "index": 5
        },
        {
          "op": "mul",
          "a": 2,
          "b": 3
        },
        {
          "op": "add",
          "a": 1,
          "b": 4
        },
        {
          "op": "mul",
          "a": 0,
          "b": 5
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 6
        }
      ]
    }
  },
  {
    "target": "windZ", "owner": "windVector", "path": ["z"], "restore": false,
    "program": {
      "id": "pine.weather.windZ",
      "reads": [
        "overcast",
        "fog",
        "rain",
        "wet",
        "wind",
        "gust",
        "hold",
        "x",
        "z",
        "baseHeight",
        "baseFalloff",
        "baseMist",
        "room",
        "windX",
        "windZ"
      ],
      "nodes": [
        {
          "op": "read",
          "index": 14
        },
        {
          "op": "constant",
          "value": 3
        },
        {
          "op": "constant",
          "value": 7
        },
        {
          "op": "read",
          "index": 5
        },
        {
          "op": "mul",
          "a": 2,
          "b": 3
        },
        {
          "op": "add",
          "a": 1,
          "b": 4
        },
        {
          "op": "mul",
          "a": 0,
          "b": 5
        }
      ],
      "channels": [
        {
          "property": "value",
          "value": 6
        }
      ]
    }
  }
  , { target: "fogBlobAmt", owner: "weather", path: ["fogBlobAmt", "value"], restore: true, program: null }
] as const;

/** Build-only: emit the existing straight-line weather DAGs in the platform client-channel section. */
export const PINE_WEATHER_PROGRAMS=parseClientChannels(PINE_WEATHER_CHANNELS.flatMap(row=>row.program===null?[]:[{
 ...row.program,numeric:{group:'weather',outputs:[{property:'value',target:row.owner,path:[...row.path],restore:row.restore,nullable:row.owner==='volume'}],
 restoreOnly:row===PINE_WEATHER_CHANNELS[0]?PINE_WEATHER_CHANNELS.filter(extra=>extra.program===null&&extra.restore).map(extra=>({property:'value',target:extra.owner,path:[...extra.path],restore:true})):[]},
}]));

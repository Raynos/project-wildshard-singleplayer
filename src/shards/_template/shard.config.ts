import { parseShardfile } from '@wildshard/sdk/shardfile';

// SF16 replaces this empty product with the teaching shard's baked content.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as a project entry.
export default parseShardfile({
  "version": 0,
  "identity": {
    "slug": "template",
    "name": "Teaching template",
    "author": "Wildshard",
    "revision": 1,
    "seed": 357
  },
  "requires": {
    "sdk": 0,
    "capabilities": [],
    "commons": []
  },
  "budgets": {
    "library": {
      "resident": 0,
      "compressed": 0
    },
    "sim": {
      "resident": 0,
      "compressed": 0
    },
    "overlap": 0
  },
  "look": {
    "families": [],
    "grade": {
      "exposure": 0,
      "saturation": 1,
      "contrast": 1,
      "lut": null
    },
    "clock": "engine",
    "dayOverride": null,
    "keys": []
  },
  "sim": {
    "fixedHz": 60,
    "scriptTickDivisor": 2,
    "commandVersion": 0,
    "snapshotVersion": 0,
    "scripts": []
  },
  "state": {
    "version": 1,
    "sharedOwner": "host",
    "playerKey": "actorId",
    "shared": [],
    "player": []
  },
  "authorCaps": {
    "players": 32,
    "speed": 15
  },
  "serverBudget": {
    "tickMicros": 1000,
    "memory": 1000000,
    "entities": 100,
    "commandsPerTick": 32
  },
  "edge": {
    "north": {
      "heights": [
        0,
        0
      ],
      "colours": [
        [
          0.5,
          0.5,
          0.5
        ],
        [
          0.5,
          0.5,
          0.5
        ]
      ],
      "roadHeight": 0
    },
    "east": {
      "heights": [
        0,
        0
      ],
      "colours": [
        [
          0.5,
          0.5,
          0.5
        ],
        [
          0.5,
          0.5,
          0.5
        ]
      ],
      "roadHeight": 0
    },
    "south": {
      "heights": [
        0,
        0
      ],
      "colours": [
        [
          0.5,
          0.5,
          0.5
        ],
        [
          0.5,
          0.5,
          0.5
        ]
      ],
      "roadHeight": 0
    },
    "west": {
      "heights": [
        0,
        0
      ],
      "colours": [
        [
          0.5,
          0.5,
          0.5
        ],
        [
          0.5,
          0.5,
          0.5
        ]
      ],
      "roadHeight": 0
    }
  },
  "files": [],
  "tiles": [],
  "library": [],
  "critical": [],
  "far": null
});

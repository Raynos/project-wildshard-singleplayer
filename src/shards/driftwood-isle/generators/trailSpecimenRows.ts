/** The original six bounded Explorer parameter records; no arbitrary procedural shapes ship. */
export const TRAIL_SPECIMEN_ROWS = [
  {
    "kind": "fence-post",
    "id": "fencePost",
    "params": {},
    "size": [
      3,
      2,
      3
    ]
  },
  {
    "kind": "signpost",
    "id": "two",
    "params": {
      "arrows": [
        -1.27,
        0.35
      ],
      "labels": [
        "HUT",
        "LOOKOUT"
      ]
    },
    "size": [
      4,
      3,
      4
    ]
  },
  {
    "kind": "signpost",
    "id": "one",
    "params": {
      "arrows": [
        1.2
      ],
      "labels": [
        "WRECK"
      ]
    },
    "size": [
      4,
      3,
      4
    ]
  },
  {
    "kind": "signpost",
    "id": "three",
    "params": {
      "arrows": [
        0.45,
        0.75,
        -0.87
      ],
      "labels": [
        "LOOKOUT",
        "WRECK",
        "SHRINE"
      ]
    },
    "size": [
      4,
      3,
      4
    ]
  },
  {
    "kind": "plank-step",
    "id": "light",
    "params": {
      "w": 2.4,
      "roll": 0,
      "yaw": 0,
      "dark": false
    },
    "size": [
      3,
      2,
      3
    ]
  },
  {
    "kind": "plank-step",
    "id": "dark",
    "params": {
      "w": 2.4,
      "roll": 0,
      "yaw": 0,
      "dark": true
    },
    "size": [
      3,
      2,
      3
    ]
  }
] as const;

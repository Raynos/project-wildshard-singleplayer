/** Waystone prompts borrow native flag rules and the entered sound timer; the quest view draws lights from flags. */
export const PINE_LANTERN_PAGE = {
  "actions": [
    {
      "id": "pond",
      "interaction": "lantern.pond",
      "needs": [
        {
          "none": [
            "lit:pond"
          ],
          "else": "already"
        }
      ],
      "denied": {
        "refused": "The pond lantern is cold — its glass is gone"
      },
      "refused": {
        "refused": [
          {
            "kind": "call",
            "target": "pond.locked"
          }
        ]
      },
      "after": [
        {
          "kind": "call",
          "target": "pond.creak"
        },
        {
          "kind": "call",
          "target": "pond.light"
        },
        {
          "kind": "call",
          "target": "pond.ignite"
        },
        {
          "kind": "toast",
          "text": "The pond lantern burns again"
        }
      ]
    },
    {
      "id": "ridge",
      "interaction": "lantern.ridge",
      "needs": [
        {
          "none": [
            "lit:ridge"
          ],
          "else": "already"
        }
      ],
      "denied": {
        "refused": "The ridge lantern is cold — you have nothing to light it with"
      },
      "refused": {
        "refused": [
          {
            "kind": "call",
            "target": "ridge.locked"
          }
        ]
      },
      "after": [
        {
          "kind": "call",
          "target": "ridge.creak"
        },
        {
          "kind": "call",
          "target": "ridge.light"
        },
        {
          "kind": "call",
          "target": "ridge.ignite"
        },
        {
          "kind": "toast",
          "text": "The ridge lantern burns again"
        }
      ]
    },
    {
      "id": "den",
      "interaction": "lantern.den",
      "needs": [
        {
          "none": [
            "lit:den"
          ],
          "else": "already"
        }
      ],
      "denied": {
        "refused": "A cold waystone lantern"
      },
      "refused": {
        "refused": [
          {
            "kind": "call",
            "target": "den.locked"
          }
        ]
      },
      "after": [
        {
          "kind": "call",
          "target": "den.creak"
        },
        {
          "kind": "call",
          "target": "den.light"
        },
        {
          "kind": "call",
          "target": "den.ignite"
        },
        {
          "kind": "toast",
          "text": "The den lantern burns again"
        }
      ]
    }
  ],
  "prompts": [
    {
      "id": "pond",
      "at": {
        "owner": "points",
        "path": [
          "pond"
        ]
      },
      "label": "The pond lantern is cold — its glass is gone",
      "labels": [
        {
          "when": {
            "all": [
              "taken:pond-glass"
            ]
          },
          "text": "Relight the pond lantern"
        }
      ],
      "radius": 2.8,
      "when": {
        "none": [
          "lit:pond"
        ]
      }
    },
    {
      "id": "ridge",
      "at": {
        "owner": "points",
        "path": [
          "ridge"
        ]
      },
      "label": "The ridge lantern is cold — you have nothing to light it with",
      "labels": [
        {
          "when": {
            "all": [
              "taken:ridge-flint"
            ]
          },
          "text": "Relight the ridge lantern"
        }
      ],
      "radius": 2.8,
      "when": {
        "none": [
          "lit:ridge"
        ]
      }
    },
    {
      "id": "den",
      "at": {
        "owner": "points",
        "path": [
          "den"
        ]
      },
      "label": "A cold waystone lantern",
      "labels": [
        {
          "when": {
            "all": [
              "talked:ranger"
            ]
          },
          "text": "Relight the den lantern"
        }
      ],
      "radius": 2.8,
      "when": {
        "none": [
          "lit:den"
        ]
      }
    }
  ],
  "bindings": {
    "calls": [
      {
        "target": "pond.creak",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternCreak",
          {
            "owner": "points",
            "path": [
              "pond"
            ]
          }
        ]
      },
      {
        "target": "pond.light",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternLight",
          {
            "owner": "points",
            "path": [
              "pond"
            ]
          }
        ],
        "delay": 350
      },
      {
        "target": "pond.ignite",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "ignite",
          {
            "owner": "points",
            "path": [
              "pond"
            ]
          }
        ]
      },
      {
        "target": "pond.locked",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "locked",
          {
            "owner": "points",
            "path": [
              "pond"
            ]
          }
        ]
      },
      {
        "target": "ridge.creak",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternCreak",
          {
            "owner": "points",
            "path": [
              "ridge"
            ]
          }
        ]
      },
      {
        "target": "ridge.light",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternLight",
          {
            "owner": "points",
            "path": [
              "ridge"
            ]
          }
        ],
        "delay": 350
      },
      {
        "target": "ridge.ignite",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "ignite",
          {
            "owner": "points",
            "path": [
              "ridge"
            ]
          }
        ]
      },
      {
        "target": "ridge.locked",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "locked",
          {
            "owner": "points",
            "path": [
              "ridge"
            ]
          }
        ]
      },
      {
        "target": "den.creak",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternCreak",
          {
            "owner": "points",
            "path": [
              "den"
            ]
          }
        ]
      },
      {
        "target": "den.light",
        "owner": "sound",
        "path": [
          "shot"
        ],
        "args": [
          "lanternLight",
          {
            "owner": "points",
            "path": [
              "den"
            ]
          }
        ],
        "delay": 350
      },
      {
        "target": "den.ignite",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "ignite",
          {
            "owner": "points",
            "path": [
              "den"
            ]
          }
        ]
      },
      {
        "target": "den.locked",
        "owner": "sfx",
        "path": [
          "interact"
        ],
        "args": [
          "locked",
          {
            "owner": "points",
            "path": [
              "den"
            ]
          }
        ]
      }
    ],
    "prompts": [
      {
        "target": "pond",
        "owner": "prompts",
        "path": [
          "pond",
          "onInteract"
        ]
      },
      {
        "target": "ridge",
        "owner": "prompts",
        "path": [
          "ridge",
          "onInteract"
        ]
      },
      {
        "target": "den",
        "owner": "prompts",
        "path": [
          "den",
          "onInteract"
        ]
      }
    ]
  }
} as const;

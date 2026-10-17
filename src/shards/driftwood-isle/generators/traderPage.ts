/** Maren lends her actual shop and camera action; no flags, stock or persistence are owned by presentation. */
export const TRADER_PAGE = {
  "actions": [
    {
      "id": "trade",
      "after": [
        {
          "kind": "call",
          "target": "open-shop"
        }
      ]
    }
  ],
  "prompts": [
    {
      "id": "trade",
      "label": "Trade with Maren",
      "radius": 2.8,
      "at": {
        "owner": "shop",
        "path": [
          "at"
        ]
      },
      "when": {
        "all": [
          "shop.ready"
        ],
        "none": [
          "shop.open"
        ]
      }
    }
  ],
  "bindings": {
    "observations": [
      {
        "target": "shop.ready",
        "owner": "shop",
        "path": [
          "ready"
        ]
      },
      {
        "target": "shop.open",
        "owner": "shop",
        "path": [
          "open"
        ]
      }
    ],
    "calls": [
      {
        "target": "open-shop",
        "owner": "commands",
        "path": [
          "trade"
        ]
      }
    ],
    "prompts": [
      {
        "target": "trade",
        "owner": "prompts",
        "path": [
          "trade",
          "onInteract"
        ]
      }
    ]
  }
} as const;

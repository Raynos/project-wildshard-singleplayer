/** Authored offline creature layers; original variant seeds, sample positions and formant curves. */
export const ISLAND_PCM = {
  "vocal.boar": {
    "seed": [
      2654435,
      5
    ],
    "values": [
      [
        "n",
        [
          "+",
          2,
          [
            "floor",
            [
              "*",
              "random",
              2
            ]
          ]
        ]
      ]
    ],
    "duration": [
      "+",
      0.14,
      [
        "*",
        "n",
        0.22
      ]
    ],
    "steps": [
      {
        "kind": "noise",
        "at": 0,
        "type": "bandpass",
        "f": 1800,
        "q": 1.4,
        "attack": 0.01,
        "decay": 0.05,
        "gain": 0.25
      },
      {
        "kind": "values",
        "rows": [
          [
            "at",
            [
              "max",
              1,
              [
                "round",
                [
                  "*",
                  0.02,
                  "sr"
                ]
              ]
            ]
          ]
        ]
      },
      {
        "kind": "repeat",
        "count": "n",
        "max": 3,
        "index": "k",
        "body": [
          {
            "kind": "values",
            "rows": [
              [
                "d",
                [
                  "+",
                  0.11,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      0.16,
                      0.11
                    ]
                  ]
                ]
              ],
              [
                "f0a",
                [
                  "+",
                  88,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      110,
                      88
                    ]
                  ]
                ]
              ],
              [
                "f0b",
                [
                  "+",
                  62,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      72,
                      62
                    ]
                  ]
                ]
              ]
            ]
          },
          {
            "kind": "formants",
            "id": "snout",
            "rows": [
              [
                [
                  "+",
                  330,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      400,
                      330
                    ]
                  ]
                ],
                5,
                1
              ],
              [
                950,
                6,
                0.6
              ],
              [
                2300,
                7,
                0.22
              ]
            ]
          },
          {
            "kind": "voice",
            "at": "at",
            "dur": [
              "+",
              "d",
              0.06
            ],
            "f0": [
              "lerp",
              "f0a",
              "f0b",
              "u"
            ],
            "tense": 0.85,
            "breath": 0.12,
            "vowel": "snout",
            "env": [
              0.012,
              [
                "*",
                "d",
                0.6
              ],
              0.04
            ],
            "gain": 1.6,
            "rough": 0.55,
            "jitter": 0.04,
            "shimmer": 0.15
          },
          {
            "kind": "values",
            "rows": [
              [
                "at",
                [
                  "+",
                  "at",
                  [
                    "max",
                    1,
                    [
                      "round",
                      [
                        "*",
                        [
                          "+",
                          "d",
                          [
                            "+",
                            0.05,
                            [
                              "*",
                              "random",
                              [
                                "-",
                                0.09,
                                0.05
                              ]
                            ]
                          ]
                        ],
                        "sr"
                      ]
                    ]
                  ]
                ]
              ]
            ]
          }
        ]
      },
      {
        "kind": "saturate",
        "drive": 1.4
      }
    ],
    "finish": [
      0.9,
      0.02
    ]
  },
  "vocal.crab": {
    "seed": [
      2654435,
      5
    ],
    "values": [
      [
        "n",
        [
          "+",
          4,
          [
            "floor",
            [
              "*",
              "random",
              4
            ]
          ]
        ]
      ],
      [
        "at",
        0
      ],
      [
        "gap",
        [
          "+",
          0.06,
          [
            "*",
            "random",
            [
              "-",
              0.08,
              0.06
            ]
          ]
        ]
      ]
    ],
    "duration": 0.45,
    "steps": [
      {
        "kind": "repeat",
        "count": "n",
        "max": 7,
        "index": "k",
        "body": [
          {
            "kind": "click",
            "at": "at",
            "args": [
              3000,
              0.5,
              0.001
            ]
          },
          {
            "kind": "strike",
            "at": "at",
            "modes": [
              [
                [
                  "+",
                  2100,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      2400,
                      2100
                    ]
                  ]
                ],
                0.02,
                1
              ],
              [
                3300,
                0.016,
                0.7
              ],
              [
                4800,
                0.012,
                0.5
              ]
            ],
            "gain": 0.3,
            "jitter": 0.1
          },
          {
            "kind": "values",
            "rows": [
              [
                "at",
                [
                  "+",
                  "at",
                  [
                    "max",
                    1,
                    [
                      "round",
                      [
                        "*",
                        "gap",
                        "sr"
                      ]
                    ]
                  ]
                ]
              ],
              [
                "gap",
                [
                  "*",
                  "gap",
                  0.82
                ]
              ]
            ]
          }
        ]
      },
      {
        "kind": "noise",
        "at": 0,
        "type": "bandpass",
        "f": 4200,
        "q": 1.2,
        "attack": 0.05,
        "decay": 0.12,
        "gain": 0.05
      },
      {
        "kind": "bubbles",
        "at": [
          "max",
          1,
          [
            "round",
            [
              "*",
              0.03,
              "sr"
            ]
          ]
        ],
        "args": [
          8,
          0.3,
          2500,
          5000,
          0.04
        ]
      }
    ],
    "finish": [
      0.9,
      0.02
    ]
  },
  "vocal.monkey": {
    "seed": [
      2654435,
      5
    ],
    "values": [],
    "duration": 0.7,
    "steps": [
      {
        "kind": "repeat",
        "count": 2,
        "max": 2,
        "index": "k",
        "body": [
          {
            "kind": "values",
            "rows": [
              [
                "d",
                [
                  "if",
                  [
                    "lt",
                    "k",
                    1
                  ],
                  [
                    "+",
                    0.18,
                    [
                      "*",
                      "random",
                      [
                        "-",
                        0.24,
                        0.18
                      ]
                    ]
                  ],
                  [
                    "+",
                    0.26,
                    [
                      "*",
                      "random",
                      [
                        "-",
                        0.34,
                        0.26
                      ]
                    ]
                  ]
                ]
              ],
              [
                "top",
                [
                  "+",
                  1300,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      1650,
                      1300
                    ]
                  ]
                ]
              ]
            ]
          },
          {
            "kind": "formants",
            "id": "ee",
            "rows": [
              [
                1150,
                4,
                1
              ],
              [
                2500,
                5,
                0.7
              ],
              [
                3700,
                6,
                0.35
              ]
            ]
          },
          {
            "kind": "voice",
            "at": [
              "max",
              1,
              [
                "round",
                [
                  "*",
                  [
                    "*",
                    "k",
                    0.27
                  ],
                  "sr"
                ]
              ]
            ],
            "dur": [
              "+",
              "d",
              0.08
            ],
            "f0": [
              "+",
              [
                "if",
                [
                  "lt",
                  "u",
                  0.35
                ],
                [
                  "lerp",
                  [
                    "*",
                    "top",
                    0.5
                  ],
                  "top",
                  [
                    "/",
                    "u",
                    0.35
                  ]
                ],
                [
                  "lerp",
                  "top",
                  [
                    "*",
                    "top",
                    0.72
                  ],
                  [
                    "/",
                    [
                      "-",
                      "u",
                      0.35
                    ],
                    0.65
                  ]
                ]
              ],
              [
                "*",
                [
                  "sin",
                  [
                    "*",
                    "u",
                    "d",
                    2,
                    3.141592653589793,
                    24
                  ]
                ],
                70
              ]
            ],
            "tense": 0.95,
            "breath": 0.28,
            "vowel": "ee",
            "env": [
              0.015,
              [
                "*",
                "d",
                0.55
              ],
              0.05
            ],
            "gain": 1.3,
            "rough": 0.25,
            "jitter": 0.03,
            "shimmer": 0.12
          }
        ]
      },
      {
        "kind": "noise",
        "at": 0,
        "type": "bandpass",
        "f": 3200,
        "q": 1.2,
        "attack": 0.02,
        "decay": 0.15,
        "gain": 0.08
      },
      {
        "kind": "saturate",
        "drive": 1.3
      }
    ],
    "finish": [
      0.9,
      0.02
    ]
  },
  "vocal.sailor": {
    "seed": [
      2654435,
      5
    ],
    "values": [
      [
        "dur",
        [
          "+",
          1.2,
          [
            "*",
            "random",
            [
              "-",
              1.45,
              1.2
            ]
          ]
        ]
      ],
      [
        "f0a",
        [
          "+",
          92,
          [
            "*",
            "random",
            [
              "-",
              102,
              92
            ]
          ]
        ]
      ]
    ],
    "duration": [
      "+",
      "dur",
      0.2
    ],
    "steps": [
      {
        "kind": "formants",
        "id": "oo",
        "rows": [
          [
            320,
            5,
            1
          ],
          [
            800,
            6,
            0.45
          ],
          [
            2400,
            8,
            0.1
          ]
        ]
      },
      {
        "kind": "formants",
        "id": "aa",
        "rows": [
          [
            620,
            5,
            1
          ],
          [
            1050,
            6,
            0.6
          ],
          [
            2500,
            8,
            0.15
          ]
        ]
      },
      {
        "kind": "voice",
        "at": 0,
        "dur": "dur",
        "f0": [
          "*",
          "f0a",
          1,
          [
            "lerp",
            1,
            0.74,
            "u"
          ],
          [
            "+",
            1,
            [
              "*",
              0.012,
              [
                "sin",
                [
                  "*",
                  "u",
                  "dur",
                  2,
                  3.141592653589793,
                  5.5
                ]
              ]
            ]
          ]
        ],
        "tense": [
          "lerp",
          0.45,
          0.25,
          "u"
        ],
        "breath": 0.22,
        "vowel": "oo",
        "env": [
          0.18,
          [
            "*",
            "dur",
            0.45
          ],
          [
            "*",
            "dur",
            0.2
          ]
        ],
        "gain": [
          "*",
          1.4,
          1
        ],
        "rough": 0.3,
        "jitter": 0.045,
        "shimmer": 0.18,
        "blend": {
          "to": "aa",
          "amount": [
            "sin",
            [
              "*",
              [
                "min",
                1,
                [
                  "*",
                  "u",
                  1.3
                ]
              ],
              3.141592653589793
            ]
          ]
        }
      },
      {
        "kind": "voice",
        "at": 0,
        "dur": "dur",
        "f0": [
          "*",
          "f0a",
          1.031,
          [
            "lerp",
            1,
            0.74,
            "u"
          ],
          [
            "+",
            1,
            [
              "*",
              0.012,
              [
                "sin",
                [
                  "*",
                  "u",
                  "dur",
                  2,
                  3.141592653589793,
                  5.5
                ]
              ]
            ]
          ]
        ],
        "tense": [
          "lerp",
          0.45,
          0.25,
          "u"
        ],
        "breath": 0.22,
        "vowel": "oo",
        "env": [
          0.18,
          [
            "*",
            "dur",
            0.45
          ],
          [
            "*",
            "dur",
            0.2
          ]
        ],
        "gain": [
          "*",
          1.4,
          0.45
        ],
        "rough": 0.3,
        "jitter": 0.045,
        "shimmer": 0.18,
        "blend": {
          "to": "aa",
          "amount": [
            "sin",
            [
              "*",
              [
                "min",
                1,
                [
                  "*",
                  "u",
                  1.3
                ]
              ],
              3.141592653589793
            ]
          ]
        }
      },
      {
        "kind": "flutter",
        "f": 14,
        "q": 0.7,
        "base": 0.65,
        "depth": 0.35,
        "drive": 12
      },
      {
        "kind": "bubbles",
        "at": [
          "max",
          1,
          [
            "round",
            [
              "*",
              0.15,
              "sr"
            ]
          ]
        ],
        "args": [
          16,
          [
            "*",
            "dur",
            0.8
          ],
          250,
          900,
          0.1
        ]
      },
      {
        "kind": "filter",
        "type": "lowpass",
        "f": 3000,
        "q": 0.7
      }
    ],
    "finish": [
      0.9,
      0.12
    ]
  },
  "windup.boar": {
    "seed": [
      31337,
      7
    ],
    "values": [
      [
        "second",
        [
          "+",
          0.28,
          [
            "*",
            "random",
            [
              "-",
              0.34,
              0.28
            ]
          ]
        ]
      ]
    ],
    "duration": 0.85,
    "steps": [
      {
        "kind": "repeat",
        "count": 2,
        "max": 2,
        "index": "k",
        "body": [
          {
            "kind": "values",
            "rows": [
              [
                "at",
                [
                  "max",
                  1,
                  [
                    "round",
                    [
                      "*",
                      [
                        "if",
                        [
                          "lt",
                          "k",
                          1
                        ],
                        0,
                        "second"
                      ],
                      "sr"
                    ]
                  ]
                ]
              ]
            ]
          },
          {
            "kind": "thump",
            "at": "at",
            "args": [
              95,
              55,
              0.04,
              0.5
            ]
          },
          {
            "kind": "noise",
            "at": "at",
            "type": "bandpass",
            "f": 1600,
            "f1": 850,
            "q": 0.8,
            "attack": 0.04,
            "decay": 0.07,
            "gain": 0.35
          },
          {
            "kind": "grains",
            "at": "at",
            "rate": 900,
            "dur": 0.16,
            "f": 2200,
            "q": 0.9,
            "gain": 0.4,
            "shape": 1
          },
          {
            "kind": "noise",
            "at": [
              "+",
              "at",
              [
                "max",
                1,
                [
                  "round",
                  [
                    "*",
                    0.03,
                    "sr"
                  ]
                ]
              ]
            ],
            "type": "highpass",
            "f": 3200,
            "attack": 0.02,
            "decay": 0.06,
            "gain": 0.12
          }
        ]
      },
      {
        "kind": "noise",
        "at": [
          "max",
          1,
          [
            "round",
            [
              "*",
              0.62,
              "sr"
            ]
          ]
        ],
        "type": "bandpass",
        "f": 1500,
        "f1": 900,
        "q": 1.6,
        "attack": 0.012,
        "decay": 0.07,
        "gain": 0.45
      }
    ],
    "finish": [
      0.9,
      0.02
    ]
  },
  "windup.crab": {
    "seed": [
      31337,
      7
    ],
    "values": [
      [
        "time",
        0
      ],
      [
        "gap",
        0.03
      ]
    ],
    "duration": 0.55,
    "steps": [
      {
        "kind": "repeat",
        "count": 16,
        "max": 16,
        "index": "k",
        "body": [
          {
            "kind": "strike",
            "at": [
              "max",
              1,
              [
                "round",
                [
                  "*",
                  "time",
                  "sr"
                ]
              ]
            ],
            "modes": [
              [
                [
                  "+",
                  2500,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      4000,
                      2500
                    ]
                  ]
                ],
                0.008,
                1
              ],
              [
                [
                  "+",
                  1200,
                  [
                    "*",
                    "random",
                    [
                      "-",
                      1600,
                      1200
                    ]
                  ]
                ],
                0.01,
                0.5
              ]
            ],
            "gain": [
              "+",
              0.15,
              [
                "*",
                "k",
                0.01
              ]
            ],
            "jitter": 0.05
          },
          {
            "kind": "values",
            "rows": [
              [
                "time",
                [
                  "+",
                  "time",
                  "gap"
                ]
              ],
              [
                "gap",
                [
                  "max",
                  0.009,
                  [
                    "*",
                    "gap",
                    0.86
                  ]
                ]
              ]
            ]
          }
        ],
        "while": [
          "lt",
          "time",
          0.4
        ]
      },
      {
        "kind": "values",
        "rows": [
          [
            "at",
            [
              "max",
              1,
              [
                "round",
                [
                  "*",
                  [
                    "+",
                    "time",
                    0.02
                  ],
                  "sr"
                ]
              ]
            ]
          ]
        ]
      },
      {
        "kind": "click",
        "at": "at",
        "args": [
          3500,
          0.7,
          0.0015
        ]
      },
      {
        "kind": "strike",
        "at": "at",
        "modes": [
          [
            2200,
            0.025,
            1
          ],
          [
            3300,
            0.02,
            0.7
          ],
          [
            700,
            0.04,
            0.4
          ]
        ],
        "gain": 0.4
      }
    ],
    "finish": [
      0.9,
      0.02
    ]
  },
  "windup.sailor": {
    "seed": [
      31337,
      7
    ],
    "values": [],
    "duration": 1,
    "steps": [
      {
        "kind": "noise",
        "at": 0,
        "type": "lowpass",
        "f": 150,
        "f1": 1600,
        "q": 1.2,
        "attack": 0.12,
        "decay": 0.18,
        "gain": 1,
        "pink": true
      },
      {
        "kind": "grains",
        "at": [
          "max",
          1,
          [
            "round",
            [
              "*",
              0.05,
              "sr"
            ]
          ]
        ],
        "rate": 70,
        "dur": 0.85,
        "f": 3000,
        "q": 0.8,
        "gain": 0.5,
        "grain": 0.0012,
        "shape": 1
      },
      {
        "kind": "sine",
        "f": 110,
        "gain": 0.12,
        "envelope": [
          "*",
          [
            "min",
            1,
            [
              "/",
              "t",
              0.3
            ]
          ],
          [
            "exp",
            [
              "/",
              [
                "-",
                0,
                [
                  "max",
                  0,
                  [
                    "-",
                    "t",
                    0.35
                  ]
                ]
              ],
              0.35
            ]
          ]
        ]
      },
      {
        "kind": "sine",
        "f": 164.8,
        "gain": 0.08,
        "envelope": [
          "*",
          [
            "min",
            1,
            [
              "/",
              "t",
              0.3
            ]
          ],
          [
            "exp",
            [
              "/",
              [
                "-",
                0,
                [
                  "max",
                  0,
                  [
                    "-",
                    "t",
                    0.35
                  ]
                ]
              ],
              0.35
            ]
          ]
        ]
      },
      {
        "kind": "sine",
        "f": 220.6,
        "gain": 0.05,
        "envelope": [
          "*",
          [
            "min",
            1,
            [
              "/",
              "t",
              0.3
            ]
          ],
          [
            "exp",
            [
              "/",
              [
                "-",
                0,
                [
                  "max",
                  0,
                  [
                    "-",
                    "t",
                    0.35
                  ]
                ]
              ],
              0.35
            ]
          ]
        ]
      },
      {
        "kind": "sine",
        "f": 109.2,
        "gain": 0.08,
        "envelope": [
          "*",
          [
            "min",
            1,
            [
              "/",
              "t",
              0.3
            ]
          ],
          [
            "exp",
            [
              "/",
              [
                "-",
                0,
                [
                  "max",
                  0,
                  [
                    "-",
                    "t",
                    0.35
                  ]
                ]
              ],
              0.35
            ]
          ]
        ]
      }
    ],
    "finish": [
      0.9,
      0.08
    ]
  }
};

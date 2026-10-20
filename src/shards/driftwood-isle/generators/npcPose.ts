/** Existing NPC local pose channels; clocks and gesture acceptance remain caller-owned. */
export const TRADER_POSE = [
  {"bone": "figure","channel": "rotation.y","cases": [{"sum": [{"of": [{"mem": "turn"}]}]}]},
  {"bone": "figure","channel": "rotation.z","cases": [{"sum": [{"of": [{"wave": "t","rate": 0.42},0.018]}]}]},
  {"bone": "figure","channel": "position.x","cases": [{"sum": [{"of": [{"wave": "t","rate": 0.42},0.012]}]}]},
  {"bone": "head","channel": "rotation.x","cases": [{"sum": [{"of": [{"mem": "headPitch"}]},{"of": [{"wave": "t","rate": 1.5,"offset": 0.7},0.02]}]}]},
  {"bone": "head","channel": "rotation.y","cases": [{"sum": [{"of": [{"mem": "headYaw"}]}]}]},
  {"bone": "head","channel": "rotation.z","cases": [{"sum": [{"of": [{"wave": "t","rate": 0.55},0.05]},{"of": [{"wave": "t","rate": 0.42},-0.03]}]}]},
  {"bone": "head","channel": "position.y","cases": [{"sum": [1.48,{"of": [{"wave": "t","rate": 1.5,"offset": 0.7},0.006]}]}]},
  {"bone": "upper","channel": "rotation.x","cases": [{"sum": [{"of": [-0.7,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 3}}},{"sum": [{"of": [-0.5,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 2}}},{"sum": [{"of": [-0.55,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [{"of": [{"wave": "t","rate": 1.1},0.05]}]}]},
  {"bone": "upper","channel": "rotation.z","cases": [{"sum": [-0.1,{"of": [-0.25,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 3}}},{"sum": [-0.1,{"of": [0.18,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 2}}},{"sum": [-0.1,{"of": [-0.65,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [-0.1]}]},
  {"bone": "upper","channel": "rotation.y","cases": [{"sum": [{"of": [0.3,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 3}}},{"sum": [0],"when": {"mem": {"key": "gesture","atLeast": 2}}},{"sum": [{"of": [0.5,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [0]}]},
  {"bone": "fore","channel": "rotation.x","cases": [{"sum": [-0.12,{"of": [-0.35,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 3}}},{"sum": [-0.12,{"of": [-0.28,{"mem": "weight"}]},{"of": [{"wave": "phase","rate": 5},0.08,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 2}}},{"sum": [-0.12,{"of": [{"bounded": [1.5,{"of": [{"wave": "phase","rate": 11},0.35]}]},-1,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [-0.12]}]},
  {"bone": "figure","channel": "rotation.x","cases": [{"sum": [0],"when": {"mem": {"key": "gesture","atLeast": 3}}},{"sum": [{"of": [0.07,{"mem": "weight"}]}],"when": {"mem": {"key": "gesture","atLeast": 2}}},{"sum": [0],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [0]}]},
  {"bone": "fore","channel": "rotation.y","cases": [{"sum": [0]}]},
  {"bone": "fore","channel": "rotation.z","cases": [{"sum": [0]}]},
] as const;

export const CASTAWAY_POSE = [
  {"bone": "head","channel": "rotation.x","cases": [{"sum": [{"of": [{"mem": "headPitch"}]},{"of": [{"wave": "t","rate": 1.6},0.02]}]}]},
  {"bone": "head","channel": "rotation.y","cases": [{"sum": [{"of": [{"mem": "headYaw"}]}]}]},
  {"bone": "head","channel": "rotation.z","cases": [{"sum": [{"of": [{"wave": "t","rate": 0.5},0.05]}]}]},
  {"bone": "head","channel": "position.y","cases": [{"sum": [1.52,{"of": [{"wave": "t","rate": 1.6},0.006]}]}]},
  {"bone": "arm","channel": "rotation.x","cases": [{"sum": [0],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [{"of": [{"wave": "t","rate": 1.1},0.05]}]}]},
  {"bone": "arm","channel": "rotation.y","cases": [{"sum": [0]}]},
  {"bone": "arm","channel": "rotation.z","cases": [{"sum": [{"of": [-2.6,{"bounded": [{"of": [{"clock": "phase"},4]}],"max": 1},{"bounded": [{"of": [{"bounded": [2.2,{"of": [{"clock": "phase"},-1]}]},4]}],"min": 0,"max": 1}]},{"of": [{"wave": "phase","rate": 12},0.35,{"bounded": [{"of": [{"clock": "phase"},4]}],"max": 1},{"bounded": [{"of": [{"bounded": [2.2,{"of": [{"clock": "phase"},-1]}]},4]}],"min": 0,"max": 1}]}],"when": {"mem": {"key": "gesture","atLeast": 1}}},{"sum": [0.08,{"of": [{"bounded": [{"of": [{"wave": "t","rate": 2.3}]}],"min": 0},0.35,{"mem": "talking"}]}]}]},
  {"bone": "flames","channel": "rotation.y","cases": [{"sum": [{"of": [{"clock": "t"},0.6]}]}]},
] as const;


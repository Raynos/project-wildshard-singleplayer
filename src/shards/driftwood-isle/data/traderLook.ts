// SHARD-PLATFORM M3 (look-family rows): the travelling trader as data (npc/Trader.ts builds her): her low-poly kit meshes
// (@wildshard/sdk/kit/kitParts: body, head, upper arm, forearm), Wendell's proportions and scale. The palette: skin
// '#a86e48', teal headscarf '#2f9490' with gold trim '#e2bf62', orange tunic '#dd7a2e', cream shirt '#eee6d6', red sash
// '#7a3a34', brown trousers '#6f5a45', travel boots '#5a3d27', leather satchel '#7a5234', gold '#d8a93c'.
import type { KitMeshRow } from '@wildshard/sdk/kit/kitParts';

/** The trader's body (turns with the figure): travel boots and trousers, the tunic's flared skirt and hem, the sash knotted at the hip with two tails lifting in the wind, the torso's bands, the collar and the shirt's V, the neck, the satchel and its strap, the left arm with its fist on her hip and a gold bangle. */
export const TRADER_BODY: KitMeshRow = {
  seed: 0x7ade1,
  ao: {"floorY":0,"strength":0.45},
  parts: [
    {"kind":"box","args":[0.1,0.08,0.23],"color":"#5a3d27","at":[-0.09,0.04,0.035],"wobble":0.008},
    {"kind":"log","args":[-0.09,0.06,0,-0.09,0.31,0.005,0.06,0.058,6],"color":"#5a3d27"},
    {"kind":"log","args":[-0.09,0.29,0.005,-0.09,0.35,0.005,0.069,0.069,7],"color":"#46301f"},
    {"kind":"log","args":[-0.09,0.33,0.005,-0.095,0.68,0,0.07,0.08,7],"color":"#6f5a45"},
    {"kind":"box","args":[0.1,0.08,0.23],"color":"#5a3d27","at":[0.09,0.04,0.035],"wobble":0.008},
    {"kind":"log","args":[0.09,0.06,0,0.09,0.31,0.005,0.06,0.058,6],"color":"#5a3d27"},
    {"kind":"log","args":[0.09,0.29,0.005,0.09,0.35,0.005,0.069,0.069,7],"color":"#46301f"},
    {"kind":"log","args":[0.09,0.33,0.005,0.095,0.68,0,0.07,0.08,7],"color":"#6f5a45"},
    {"kind":"log","args":[0,0.56,0,0,0.62,0,0.258,0.252,9],"color":"#9e4a22","at":[0,0,0,0,0,0,1,1,0.8],"jitter":0.05},
    {"kind":"log","args":[0,0.6,0,0,1,0,0.25,0.19,9],"color":"#dd7a2e","at":[0,0,0,0,0,0,1,1,0.8],"jitter":0.05},
    {"kind":"log","args":[0,0.96,0,0,1.07,0,0.2,0.195,8],"color":"#7a3a34","at":[0,0,0,0,0,0,1,1,0.8]},
    {"kind":"icosa","args":[0.045,0],"color":"#7a3a34","at":[0.17,1,0.08]},
    {"kind":"log","args":[0.17,0.99,0.09,0.2,0.78,0.11,0.03,0.018,4],"color":"#7a3a34","sway":{"w":0.35,"hang":true}},
    {"kind":"log","args":[0.15,0.99,0.1,0.155,0.8,0.14,0.028,0.016,4],"color":"#7a3a34","sway":{"w":0.35,"hang":true}},
    {"kind":"log","args":[0,1.06,0,0,1.1280000000000001,0,0.178,0.192,8],"color":"#dd7a2e","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.1280000000000001,0,0,1.1960000000000002,0,0.192,0.20224871130596428,8],"color":"#cf6f27","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.1960000000000002,0,0,1.2640000000000002,0,0.20224871130596428,0.206,8],"color":"#dd7a2e","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.264,0,0,1.332,0,0.206,0.20224871130596428,8],"color":"#cf6f27","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.332,0,0,1.4000000000000001,0,0.20224871130596428,0.192,8],"color":"#dd7a2e","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.4000000000000001,0,0,1.4680000000000002,0,0.192,0.14,8],"color":"#cf6f27","at":[0,0,0,0,0,0,1,1,0.74],"jitter":0.04},
    {"kind":"log","args":[0,1.43,0,0,1.47,0,0.148,0.12,8],"color":"#9e4a22","at":[0,0,0,0,0,0,1,1,0.8]},
    {"kind":"box","args":[0.12,0.12,0.02],"color":"#eee6d6","at":[0,1.4,0.108,0,-0.25,0.7853981633974483]},
    {"kind":"log","args":[0,1.45,0,0,1.53,0.01,0.058,0.053,6],"color":"#a86e48"},
    {"kind":"box","args":[0.2,0.17,0.08],"color":"#7a5234","at":[-0.18,0.92,-0.15,-0.55],"wobble":0.006},
    {"kind":"box","args":[0.21,0.07,0.09],"color":"#5e3f27","at":[-0.18,0.99,-0.148,-0.55]},
    {"kind":"box","args":[0.03,0.03,0.02],"color":"#d8a93c","at":[-0.2,0.96,-0.2,-0.55]},
    {"kind":"rope","args":[0.017,-0.14,1.02,-0.17,-0.24,1.03,-0.04,-0.2,1.05,0.1,-0.1,1.15,0.157,0.02,1.28,0.158,0.12,1.4,0.12,0.15,1.47,0.02],"color":"#5e3f27"},
    {"kind":"rope","args":[0.017,0.15,1.47,0.02,0.12,1.4,-0.12,0.02,1.28,-0.158,-0.08,1.14,-0.17,-0.14,1.02,-0.17],"color":"#5e3f27"},
    {"kind":"log","args":[0.19,1.4,0,0.25,1.285,-0.025,0.066,0.06,6],"color":"#eee6d6"},
    {"kind":"log","args":[0.24280000000000002,1.2988,-0.022000000000000002,0.2548,1.2757999999999998,-0.027000000000000003,0.064,0.058,6],"color":"#d9ceb8"},
    {"kind":"log","args":[0.25,1.285,-0.025,0.31,1.17,-0.05,0.047,0.044,6],"color":"#a86e48"},
    {"kind":"log","args":[0.31,1.17,-0.05,0.215,1,0.035,0.044,0.038,6],"color":"#a86e48"},
    {"kind":"torus","args":[0.045,0.011,4,8],"color":"#d8a93c","matrix":[0.8572247818833542,-0.25549249557715564,0.44708976506826126,0,-0.25549249557715564,0.5428029026514058,0.8000553690695198,0,-0.44708976506826126,-0.8000553690695198,0.4000276845347601,0,0.2359,1.0373999999999999,0.01630000000000001,1]},
    {"kind":"icosa","args":[0.048,0],"color":"#a86e48","at":[0.215,1,0.035,0,0,0,0.85,1.05]},
  ],
};

/** Her head (pivot at the neck): face, nose, eyes, arched brows, lips, the fringe and temples under the teal headscarf, gold hoops, the scarf dome tipped back with its trim band, the knot and its two tails. */
export const TRADER_HEAD: KitMeshRow = {
  seed: 0x7ade2,
  ao: false,
  parts: [
    {"kind":"icosa","args":[0.11,1],"color":"#a86e48","at":[0,0.11,0,0,0,0,0.9,1.05,0.95],"wobble":0.005},
    {"kind":"cone","args":[0.026,0.06,4],"color":"#8a5636","pre":[["rotateX",1.5707963267948966]],"at":[0,0.1,0.112]},
    {"kind":"box","args":[0.026,0.02,0.01],"color":"#1d1a18","at":[-0.04,0.132,0.1]},
    {"kind":"box","args":[0.026,0.02,0.01],"color":"#1d1a18","at":[0.04,0.132,0.1]},
    {"kind":"box","args":[0.046,0.011,0.02],"color":"#2b1f19","at":[-0.041,0.158,0.098,0,0,-0.12]},
    {"kind":"box","args":[0.046,0.011,0.02],"color":"#2b1f19","at":[0.041,0.158,0.098,0,0,0.12]},
    {"kind":"box","args":[0.05,0.014,0.012],"color":"#8f4538","at":[0,0.058,0.098]},
    {"kind":"box","args":[0.13,0.022,0.03],"color":"#2b1f19","at":[0,0.172,0.088]},
    {"kind":"box","args":[0.02,0.06,0.04],"color":"#2b1f19","at":[-0.093,0.13,0.035]},
    {"kind":"torus","args":[0.03,0.006,4,9],"color":"#d8a93c","pre":[["rotateY",1.5707963267948966]],"at":[-0.1,0.045,0.012]},
    {"kind":"box","args":[0.02,0.06,0.04],"color":"#2b1f19","at":[0.093,0.13,0.035]},
    {"kind":"torus","args":[0.03,0.006,4,9],"color":"#d8a93c","pre":[["rotateY",1.5707963267948966]],"at":[0.1,0.045,0.012]},
    {"kind":"sphere","args":[0.128,10,5,0,6.283185307179586,0,1.7592918860102844],"color":"#2f9490","matrix":[1,0,0,0,0,0.7840688341641944,-0.5364103497252835,0,0,0.6098138712666381,0.8913624641024527,0,0,0.12,-0.012,1],"wobble":0.004},
    {"kind":"torus","args":[0.128,0.017,4,12],"color":"#e2bf62","pre":[["rotateX",1.5707963267948966],["translate",0,-0.022,0]],"matrix":[1,0,0,0,0,0.7840688341641944,-0.5364103497252835,0,0,0.6098138712666381,0.8913624641024527,0,0,0.12,-0.012,1]},
    {"kind":"icosa","args":[0.046,0],"color":"#23706d","at":[0,0.06,-0.13,0,0,0,1.1,0.85,0.9]},
    {"kind":"cone","args":[0.042,0.19,4],"color":"#2f9490","at":[-0.03,-0.04,-0.165,-0.25,0.4,-0.12,1,1,0.35],"sway":{"w":0.6,"hang":true}},
    {"kind":"cone","args":[0.042,0.19,4],"color":"#23706d","at":[0.03,-0.04,-0.165,0.25,0.4,0.12,1,1,0.35],"sway":{"w":0.6,"hang":true}},
  ],
};

/** Her right upper arm (pivot at the shoulder, hanging along −Y): the short puffed sleeve, its hem, the arm to the elbow. */
export const TRADER_UPPER: KitMeshRow = {
  seed: 0x7ade3,
  ao: false,
  parts: [
    {"kind":"log","args":[0,0,0,-0.015,-0.13,0.01,0.066,0.06,6],"color":"#eee6d6"},
    {"kind":"log","args":[-0.012,-0.115,0.01,-0.016,-0.15,0.011,0.064,0.058,6],"color":"#d9ceb8"},
    {"kind":"log","args":[-0.015,-0.14,0.011,-0.03,-0.27,0.02,0.047,0.044,6],"color":"#a86e48"},
  ],
};

/** Her right forearm (pivot at the elbow): the forearm, a gold bangle, an open hand and its thumb. */
export const TRADER_FORE: KitMeshRow = {
  seed: 0x7ade4,
  ao: false,
  parts: [
    {"kind":"log","args":[0,0.01,0,-0.01,-0.23,0.02,0.044,0.038,6],"color":"#a86e48"},
    {"kind":"torus","args":[0.045,0.011,4,8],"color":"#d8a93c","pre":[["rotateX",1.5707963267948966]],"at":[-0.008,-0.185,0.016]},
    {"kind":"box","args":[0.075,0.1,0.035],"color":"#a86e48","at":[-0.012,-0.28,0.024],"wobble":0.006},
    {"kind":"box","args":[0.022,0.05,0.024],"color":"#a86e48","at":[0.03,-0.26,0.04,0,0.3,0.4]},
  ],
};

// SHARD-PLATFORM M3 (look-family rows): Driftwood's castaway arms (E334, Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke") as a toon-arms row for the SDK (@wildshard/sdk/viewmodel/toonArms); fpArms.ts passes it with
// data/fpArmsGlsl.ts.
export const FP_ARMS_LOOK = {
  url: '/assets/models/driftwood-fp/fp-arms.glb',
  skeleton: 'driftwood-fp',
  sockets: ['R_weapon', 'L_hand'],
  // bake.mjs keeps Nine Dragon's round-13 skeleton and adds 15 finger bones a hand
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'], fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'], phalanges: 3 },
  // the framing: the castaway board (2 A) has the fist a little in from the frame's right edge and low, the blade's tip
  // below-right of the crosshair (E129's height); on the screen the pair smaller than Nine Dragon's rest
  offset: [-0.03, -0.012, 0],
  frame: { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 },
  // Jake's look review (2026-09-30): the body shadow must not shade the arms; they look their shadow up 1.2 m toward the light
  sunward: 1.2,
  // charm III's glow (E314: "a soft glow + halo — the blade keeps its own colour with an aqua edge"): sea-glass aqua
  glow: 0x5fe6d8,
  // the swords' blades as arms.py models them (weapon-local): the half-width at the guard end and its taper per metre
  blades: { wood: { halfW: 0.040, taper: 0.009 / 0.52 }, iron: { halfW: 0.026, taper: 0.006 / 0.56 } },
  bladeBase: 0.012,
  // the swim water line's tip toward the eye (Jake's review 2026-09-30: "the sleeves above the water while swimming"),
  // about the hands' depth (the stroke's wrists run −0.43 … −0.62)
  swim: { tilt: 1.1, handsZ: -0.5, waterY: -0.16, startD: -0.16 },
  material: { rough: 0.85, metalRough: 0.6, metal: 0.6, env: 0.6 },
  patch: { arms: 'driftwood.fp-arms', swim: 'driftwood.fp-swim' },
  prefix: 'driftwood-fp',
} as const;

// SHARD-PLATFORM M3 (look-family rows): Driftwood's castaway arms (E334, Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke") as a toon-arms row (game/systems/viewmodel/toonArms.ts); fpArms.ts passes it. The arms wear the
// graph toon look (FP_ARMS_GRAPHS, the shardfile's look.materials, compiled by the kit hook: runtime/index.ts).
// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/** the look.materials ids the arms, the two swords and the swimming arms wear */
export const FP_ARMS_MATERIALS = { arms: 'driftwood-fp-arms', wood: 'driftwood-fp-wood', iron: 'driftwood-fp-iron', swim: 'driftwood-fp-swim', pickupBlade: 'driftwood-pickup-blade', pickupFittings: 'driftwood-pickup-fittings' } as const;

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
  // the blade's base (weapon-local m) when the rig's meta has none
  bladeBase: 0.012,
  // the swim water line's tip toward the eye (Jake's review 2026-09-30: "the sleeves above the water while swimming"),
  // about the hands' depth (the stroke's wrists run −0.43 … −0.62)
  swim: { tilt: 1.1, handsZ: -0.5, waterY: -0.16, startD: -0.16 },
  materials: FP_ARMS_MATERIALS,
} as const;

/**
 * Driftwood Isle's runtime copies of build-time constants (G449: whatever the standalone runtime needs is duplicated into
 * it; P2a spec §2.3). Each export mirrors a `data/` value that `data/runtimeMirrors.ts` names, and
 * `test/driftwood-runtime-mirrors.test.ts` (the build's step 5 once wired) refuses any drift. Plain JSON `export const`s only.
 */

/** the look.materials ids the cascade's three meshes wear (data/waterfallLook.ts) */
export const CASCADE_LOOKS = { curtain: 'driftwood-cascade-curtain', pool: 'driftwood-cascade-pool', puffs: 'driftwood-cascade-puffs' } as const;
/** the look.materials id the castaway's smoke wears (data/smokeLook.ts) */
export const SMOKE_LOOK = 'driftwood-castaway-smoke';
/** the look.materials id the shrine's fireflies wear (data/fireflyLook.ts) */
export const FIREFLY_LOOK = 'driftwood-shrine-fireflies';
/** the look.materials id the reef wears (data/reefLook.ts) */
export const REEF_LOOK = 'driftwood-reef';
/** the look.materials ids the cove's pools and the ring shrine's pool wear (data/poolLook.ts) */
export const POOL_LOOK = 'driftwood-cove-pool';
export const SHRINE_POOL_LOOK = 'driftwood-shrine-pool';
/** the sea's look.materials id, its dry-socket slots, the empty dry rectangle and the sea-floor texture size (data/oceanLook.ts) */
export const OCEAN_LOOK = 'driftwood-ocean';
export const OCEAN_DRY_SLOTS = 4;
export const OCEAN_NO_DRY = [1e9, 1e9, -1e9, -1e9] as const;
export const SEA_RES = 512;
/** the look.materials id the gulls wear (data/gullGraphLook.ts) */
export const GULL_GRAPH_LOOK = 'driftwood-gulls';
/** the creature body looks (data/creatureLook.ts) */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing', captain: 'driftwood-creature-captain' } as const;
/** every ground-cover look id, near and far (data/coverLook.ts COVER_LOOKS) */
export const COVER_LOOKS = [
  'driftwood-cover-tuft', 'driftwood-cover-tuft-far', 'driftwood-cover-fern', 'driftwood-cover-fern-far',
  'driftwood-cover-hibiscus', 'driftwood-cover-hibiscus-far', 'driftwood-cover-daisy', 'driftwood-cover-daisy-far',
  'driftwood-cover-pebble', 'driftwood-cover-shells', 'driftwood-cover-starfish', 'driftwood-cover-bush', 'driftwood-cover-bush-far',
] as const;
/** the baked island's terrain, caster and cover looks (data/islandLook.ts) */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props',
  cover: 'driftwood-island-cover', coverBig: 'driftwood-island-cover-big',
} as const;
/** the look.materials ids the arms, the two swords and the swimming arms wear (data/fpArmsLook.ts) */
export const FP_ARMS_MATERIALS = { arms: 'driftwood-fp-arms', wood: 'driftwood-fp-wood', iron: 'driftwood-fp-iron', swim: 'driftwood-fp-swim', pickupBlade: 'driftwood-pickup-blade', pickupFittings: 'driftwood-pickup-fittings' } as const;
/** the castaway's first-person arms: rig, framing, shadow lookup and swim line (data/fpArmsLook.ts) */
export const FP_ARMS_LOOK = {
  url: '/assets/models/driftwood-fp/fp-arms.glb',
  skeleton: 'driftwood-fp',
  sockets: ['R_weapon', 'L_hand'],
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'], fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'], phalanges: 3 },
  offset: [-0.03, -0.012, 0],
  frame: { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 },
  sunward: 1.2,
  bladeBase: 0.012,
  swim: { tilt: 1.1, handsZ: -0.5, waterY: -0.16, startD: -0.16 },
  materials: FP_ARMS_MATERIALS,
} as const;
/** the step surfaces the island's audio maps (data/audioSurfaces.ts) */
export const ISLAND_SURFACES = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water'] as const;
export type Surface = typeof ISLAND_SURFACES[number];
/** the island's voice families, prewarmed in this order (data/audioPlayback.ts) */
export const ISLAND_FAMILIES = [
  'step-sand', 'step-planks', 'step-grass', 'step-wetSand', 'step-rock', 'step-water', 'step-stone',
  'whoosh', 'impact-flesh', 'hurt', 'impact-shell', 'impact-wood', 'impact-stone', 'whoosh-heavy',
  'vocal-boar', 'vocal-crab', 'vocal-monkey', 'vocal-sailor', 'windup-boar', 'windup-crab', 'windup-sailor',
  'plunge-down', 'plunge-up', 'death', 'ui-chime', 'ui-chest', 'ui-locked', 'ui-lever', 'ui-plate', 'ui-door', 'ui-grate', 'ui-glyph', 'ui-ignite',
] as const;

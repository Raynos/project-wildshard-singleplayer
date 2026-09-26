/**
 * The four round-6 mockups' cameras (art/nine-dragon-stack/round-6-baseline-hud/: A style-A-jiehua-neon, B comp-B-well-edge,
 * C comp-C-stair-street, D comp-D-well-down), eye-matched in the engine on the phone frame (402×874, the shard's
 * portrait FOV: def.ts `fov.portrait` 78 ≈ 58° across). ONE place: every capture script and dome uses these, never its
 * own copy (P0-5c, 2026-09-26).
 *
 * Coordinates are layout.ts's: x east, z SOUTH, y altitude (Lantern Square's datum Y0 = 125). `yaw` in degrees, 0 = north
 * (−z), +90 = east (+x): the engine's camera / player yaw is the NEGATIVE (rotation.y = −yaw). `pitch` in degrees, + = up
 * (the same sign in the engine). `eye` is the camera; `feet` is where the player stands for it (eye − 1.68, the engine's
 * eye height), absent when the view is not a player pose (D leans over the balustrade: a free camera).
 *
 * B and D were re-set from the clean room's shots.ts (x −10.5, B pitch −23, D standing back at −64) to the mockups: B
 * stands a metre back from the rim's balustrade on the axis of the canyon's run north, its rail across the frame's lower
 * third and the ladder of crossings centred; D leans out over the balustrade on the main shaft's axis, looking down it
 * with the rail and a post across the bottom.
 *
 * Self-contained (no imports), so Node scripts can import it as TypeScript (Node ≥ 23 strips the types).
 */
export interface MockupCamera {
  /** the mockup's file (under art/nine-dragon-stack/round-6-baseline-hud/) */
  mockup: string;
  eye: readonly [number, number, number];
  feet?: readonly [number, number, number];
  yaw: number;
  pitch: number;
  /** what the frame must show (the eye-check) */
  frame: string;
}

export const MOCKUP_CAMERAS: Readonly<Record<'A' | 'B' | 'C' | 'D', MockupCamera>> = {
  A: {
    mockup: 'style-A-jiehua-neon.jpg',
    eye: [0.95, 126.68, 7.5], feet: [0.95, 125, 7.5], yaw: 12, pitch: -4,
    frame: 'the spawn by the balustrade, looking north along it at the paifang (a third of the width) and the banyan',
  },
  B: {
    mockup: 'comp-B-well-edge.jpg',
    eye: [-19.5, 126.68, 12.25], feet: [-19.5, 125, 12.25], yaw: 0, pitch: -10,
    frame: 'on the Well\'s south rim a metre back from the balustrade (its rail across the lower third), looking north down the axis of the canyon\'s run north (x −28…−12; at x −10.5 the stub wall fills the frame): the crossings like ladder rungs receding into the mist to the far gate at z −95, the dragon hook on the right-hand gallery',
  },
  C: {
    mockup: 'comp-C-stair-street.jpg',
    eye: [18, 126.68, 6], feet: [18, 125, 6], yaw: 90, pitch: 10,
    frame: 'Lantern Square at the stair-street\'s foot, looking east up the flights to the stair gate',
  },
  D: {
    mockup: 'comp-D-well-down.jpg',
    eye: [-14, 126.9, 11.3], yaw: 0, pitch: -58,
    frame: 'leaning out over the rim\'s balustrade (the rail and a post across the bottom, the post lower left), looking down the main shaft\'s axis (x −28…0): the gate bridge high in the frame, the crossings stepping down into the mist',
  },
};

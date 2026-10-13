import { CROWN, DECK, HIGH, KEEPER, ROOST, SPAWN, STEP, WINDMILL } from './layout';

/** Original fixed developer capture poses; data only, with no runtime camera or state writes. */
export const SKY_DEV_POSES = {
    spawn: { eye: [SPAWN.x, DECK + 1.7, SPAWN.z], feet: [SPAWN.x, DECK, SPAWN.z], yaw: 0, pitch: 0, mockup: 'art/far-reach/round-1-proposals/B-sky-reach.jpg', frame: 'Spawn: Sunrest, the windmill isle across the gap' },
    hover: { eye: [12, DECK + 1.7, -2.5], feet: [12, DECK, -2.5], yaw: 80, pitch: -6, mockup: '', frame: 'The hover bridge to the Roost' },
    windmill: { eye: [WINDMILL.x - 6, DECK + 1.7, WINDMILL.z + 10], yaw: 10, pitch: 8, mockup: '', frame: 'The windmill isle' },
    roost: { eye: [ROOST.x, ROOST.y + 1.7, ROOST.z + 6], yaw: -90, pitch: 0, mockup: '', frame: 'The Roost, looking back' },
    keeper: { eye: [KEEPER.x + 4, KEEPER.y + 1.7, KEEPER.z + 8], yaw: 200, pitch: 0, mockup: '', frame: 'The keeper\'s isle and its notes' },
    updraft: { eye: [4, DECK + 2, WINDMILL.z - 10], yaw: 10, pitch: 12, mockup: '', frame: 'The updraft to the high step' },
    crown: { eye: [CROWN.x, HIGH + 1.7, CROWN.z + 16], yaw: 0, pitch: 4, mockup: '', frame: 'The storm crown' },
    step: { eye: [STEP.x - 5, HIGH + 1.7, STEP.z + 6], yaw: 20, pitch: 0, mockup: '', frame: 'The high step and the crown bridge winch' },
} as const;

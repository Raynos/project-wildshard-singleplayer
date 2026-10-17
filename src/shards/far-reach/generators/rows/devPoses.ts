import LAYOUT from '../../data/layout.generated.json' with { type: 'json' };

/** Original fixed developer capture poses; data only, with no runtime camera or state writes. */
export const SKY_DEV_POSES = {
    spawn: { eye: [LAYOUT.SPAWN.x, LAYOUT.DECK + 1.7, LAYOUT.SPAWN.z], feet: [LAYOUT.SPAWN.x, LAYOUT.DECK, LAYOUT.SPAWN.z], yaw: 0, pitch: 0, mockup: 'art/far-reach/round-1-proposals/B-sky-reach.jpg', frame: 'Spawn: Sunrest, the windmill isle across the gap' },
    hover: { eye: [12, LAYOUT.DECK + 1.7, -2.5], feet: [12, LAYOUT.DECK, -2.5], yaw: 80, pitch: -6, mockup: '', frame: 'The hover bridge to the Roost' },
    windmill: { eye: [LAYOUT.WINDMILL.x - 6, LAYOUT.DECK + 1.7, LAYOUT.WINDMILL.z + 10], yaw: 10, pitch: 8, mockup: '', frame: 'The windmill isle' },
    roost: { eye: [LAYOUT.ROOST.x, LAYOUT.ROOST.y + 1.7, LAYOUT.ROOST.z + 6], yaw: -90, pitch: 0, mockup: '', frame: 'The Roost, looking back' },
    keeper: { eye: [LAYOUT.KEEPER.x + 4, LAYOUT.KEEPER.y + 1.7, LAYOUT.KEEPER.z + 8], yaw: 200, pitch: 0, mockup: '', frame: 'The keeper\'s isle and its notes' },
    updraft: { eye: [4, LAYOUT.DECK + 2, LAYOUT.WINDMILL.z - 10], yaw: 10, pitch: 12, mockup: '', frame: 'The updraft to the high step' },
    crown: { eye: [LAYOUT.CROWN.x, LAYOUT.HIGH + 1.7, LAYOUT.CROWN.z + 16], yaw: 0, pitch: 4, mockup: '', frame: 'The storm crown' },
    step: { eye: [LAYOUT.STEP.x - 5, LAYOUT.HIGH + 1.7, LAYOUT.STEP.z + 6], yaw: 20, pitch: 0, mockup: '', frame: 'The high step and the crown bridge winch' },
} as const;

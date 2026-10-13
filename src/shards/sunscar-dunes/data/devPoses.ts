import { STRINGS } from './strings';
import { SPAWN, TOWER } from './layout';
import ground from './manifestGround.generated.json' with { type: 'json' };

const { towerY, heights } = ground;

/** Original fixed developer capture poses; data only, with no runtime camera or state writes. */
export const SIGNAL_DEV_POSES = {
    spawn: { eye: [SPAWN.x, heights.spawn + 1.6, SPAWN.z], feet: [SPAWN.x, heights.spawn, SPAWN.z], yaw: 0, pitch: 2, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame: STRINGS.frameSpawn },
    whip: { eye: [SPAWN.x, heights.whip + 1.6, SPAWN.z - 4], feet: [SPAWN.x, heights.whip, SPAWN.z - 4], yaw: -20, pitch: -4, mockup: '', frame: STRINGS.frameWhip },
    ray: { eye: [SPAWN.x, heights.spawn + 1.6, SPAWN.z], feet: [SPAWN.x, heights.spawn, SPAWN.z], yaw: -3, pitch: 9, mockup: '', frame: STRINGS.frameRay },
    quest: { eye: [TOWER.x - 4, heights.quest + 1.6, TOWER.z + 12], feet: [TOWER.x - 4, heights.quest, TOWER.z + 12], yaw: 15, pitch: 22, mockup: '', frame: STRINGS.frameQuest },
    tower: { eye: [TOWER.x, towerY + TOWER.deck + 1.6, TOWER.z + 1], yaw: 180, pitch: -8, mockup: '', frame: STRINGS.tower },
} as const;

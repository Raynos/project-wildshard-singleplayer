import { STRINGS } from './strings';
import LAYOUT from './layout.generated.json' with { type: 'json' };
import ground from './manifestGround.generated.json' with { type: 'json' };

const { towerY, heights } = ground;

/** Original fixed developer capture poses; data only, with no runtime camera or state writes. */
export const SIGNAL_DEV_POSES = {
    spawn: { eye: [LAYOUT.SPAWN.x, heights.spawn + 1.6, LAYOUT.SPAWN.z], feet: [LAYOUT.SPAWN.x, heights.spawn, LAYOUT.SPAWN.z], yaw: 0, pitch: 2, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame: STRINGS.frameSpawn },
    whip: { eye: [LAYOUT.SPAWN.x, heights.whip + 1.6, LAYOUT.SPAWN.z - 4], feet: [LAYOUT.SPAWN.x, heights.whip, LAYOUT.SPAWN.z - 4], yaw: -20, pitch: -4, mockup: '', frame: STRINGS.frameWhip },
    ray: { eye: [LAYOUT.SPAWN.x, heights.spawn + 1.6, LAYOUT.SPAWN.z], feet: [LAYOUT.SPAWN.x, heights.spawn, LAYOUT.SPAWN.z], yaw: -3, pitch: 9, mockup: '', frame: STRINGS.frameRay },
    quest: { eye: [LAYOUT.TOWER.x - 4, heights.quest + 1.6, LAYOUT.TOWER.z + 12], feet: [LAYOUT.TOWER.x - 4, heights.quest, LAYOUT.TOWER.z + 12], yaw: 15, pitch: 22, mockup: '', frame: STRINGS.frameQuest },
    tower: { eye: [LAYOUT.TOWER.x, towerY + LAYOUT.TOWER.deck + 1.6, LAYOUT.TOWER.z + 1], yaw: 180, pitch: -8, mockup: '', frame: STRINGS.tower },
} as const;

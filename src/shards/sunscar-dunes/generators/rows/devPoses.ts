import STRINGS from '../../data/strings.json' with { type: 'json' };
import * as LAYOUT from '../layout';
import { signalManifestMetadata } from '../manifestGround';

const ground = signalManifestMetadata();

const { towerY, heights } = ground;

/** Original fixed developer capture poses; data only, with no runtime camera or state writes. */
export const SIGNAL_DEV_POSES: { readonly spawn: { readonly eye: readonly [number, number, number]; readonly feet: readonly [number, number, number]; readonly yaw: 0; readonly pitch: 2; readonly mockup: "art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg"; readonly frame: string; }; readonly whip: { readonly eye: readonly [number, number, number]; readonly feet: readonly [number, number, number]; readonly yaw: -20; readonly pitch: -4; readonly mockup: ""; readonly frame: string; }; readonly ray: { readonly eye: readonly [number, number, number]; readonly feet: readonly [number, number, number]; readonly yaw: -3; readonly pitch: 9; readonly mockup: ""; readonly frame: string; }; readonly quest: { readonly eye: readonly [number, number, number]; readonly feet: readonly [number, number, number]; readonly yaw: 15; readonly pitch: 22; readonly mockup: ""; readonly frame: string; }; readonly tower: { readonly eye: readonly [number, number, number]; readonly yaw: 180; readonly pitch: -8; readonly mockup: ""; readonly frame: string; }; } = {
    spawn: { eye: [LAYOUT.SPAWN.x, heights.spawn + 1.6, LAYOUT.SPAWN.z], feet: [LAYOUT.SPAWN.x, heights.spawn, LAYOUT.SPAWN.z], yaw: 0, pitch: 2, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame: STRINGS.frameSpawn },
    whip: { eye: [LAYOUT.SPAWN.x, heights.whip + 1.6, LAYOUT.SPAWN.z - 4], feet: [LAYOUT.SPAWN.x, heights.whip, LAYOUT.SPAWN.z - 4], yaw: -20, pitch: -4, mockup: '', frame: STRINGS.frameWhip },
    ray: { eye: [LAYOUT.SPAWN.x, heights.spawn + 1.6, LAYOUT.SPAWN.z], feet: [LAYOUT.SPAWN.x, heights.spawn, LAYOUT.SPAWN.z], yaw: -3, pitch: 9, mockup: '', frame: STRINGS.frameRay },
    quest: { eye: [LAYOUT.TOWER.x - 4, heights.quest + 1.6, LAYOUT.TOWER.z + 12], feet: [LAYOUT.TOWER.x - 4, heights.quest, LAYOUT.TOWER.z + 12], yaw: 15, pitch: 22, mockup: '', frame: STRINGS.frameQuest },
    tower: { eye: [LAYOUT.TOWER.x, towerY + LAYOUT.TOWER.deck + 1.6, LAYOUT.TOWER.z + 1], yaw: 180, pitch: -8, mockup: '', frame: STRINGS.tower },
} as const;

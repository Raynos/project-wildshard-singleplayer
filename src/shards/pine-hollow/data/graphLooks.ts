import type { GraphIr } from '@wildshard/format/materialGraph';
import { CABIN_DOOR_GRAPHS, CABIN_MOSS_GRAPHS } from './cabinLook';
import { CAVE_SHAFT_GRAPHS } from './caveShaftLook';
import { CRAG_GRAPHS } from './cragLook';
import { FOREST_GRAPHS } from './forestLook';
import { HEARTH_GRAPHS } from './hearthLook';
import { KING_FX_GRAPHS } from './kingFxLook';
import { SKY_GRAPHS } from './skyLook';
import { SPRAY_GRAPHS } from './streamLook';
import { UNDER_GRAPHS } from './undergrowthLook';
import { RAIN_GRAPHS } from './weatherLook';
import { WATER_GRAPHS } from './waterLook';

/**
 * Every SF59 material graph Pine Hollow's runtime draws its own meshes in, by look.materials id: the cabin doors,
 * roofs and stone (./cabinLook.ts), the hearth particles (./hearthLook.ts), the cave's shaft (./caveShaftLook.ts), the crags' granite (./cragLook.ts), the waterfall's
 * spray (./streamLook.ts), the water (./waterLook.ts), the Antler King fight's fog wall and fallen-lantern flames (./kingFxLook.ts), the rain's splashes and lens drops (./weatherLook.ts) and the forest floor's undergrowth
 * (./undergrowthLook.ts). shard.config.ts
 * declares them in the shardfile's look.materials; runtime/index.ts compiles them all before the streams build.
 */
export const PINE_GRAPHS: Readonly<Record<string, GraphIr>> = { ...CABIN_DOOR_GRAPHS, ...CABIN_MOSS_GRAPHS, ...HEARTH_GRAPHS, ...CAVE_SHAFT_GRAPHS, ...CRAG_GRAPHS, ...SPRAY_GRAPHS, ...KING_FX_GRAPHS, ...RAIN_GRAPHS, ...UNDER_GRAPHS, ...WATER_GRAPHS };

/** Every look.materials graph the shardfile declares: the runtime's (above), the sky backdrop's (./skyLook.ts, compiled
 *  by look/render.ts's keyed sky before the world stage) and the forest's (./forestLook.ts, compiled by the trees' boot
 *  step, world/treeFactory.ts). */
export const PINE_LOOK_GRAPHS: Readonly<Record<string, GraphIr>> = { ...PINE_GRAPHS, ...SKY_GRAPHS, ...FOREST_GRAPHS };

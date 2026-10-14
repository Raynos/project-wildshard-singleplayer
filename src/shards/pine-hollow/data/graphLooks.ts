import type { GraphIr } from '@wildshard/format/materialGraph';
import { CAVE_SHAFT_GRAPHS } from './caveShaftLook';
import { HEARTH_GRAPHS } from './hearthLook';
import { SPRAY_GRAPHS } from './streamLook';
import { RAIN_GRAPHS } from './weatherLook';

/**
 * Every SF59 material graph Pine Hollow's runtime draws its own meshes in, by look.materials id: the hearth particles
 * (./hearthLook.ts), the cave's shaft (./caveShaftLook.ts), the waterfall's spray (./streamLook.ts) and the rain's
 * lens drops (./weatherLook.ts). shard.config.ts
 * declares them in the shardfile's look.materials; runtime/index.ts compiles them all before the streams build.
 */
export const PINE_GRAPHS: Readonly<Record<string, GraphIr>> = { ...HEARTH_GRAPHS, ...CAVE_SHAFT_GRAPHS, ...SPRAY_GRAPHS, ...RAIN_GRAPHS };

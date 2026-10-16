import type { GraphIr } from '@wildshard/format/materialGraph';
import { CABIN_DOOR_GRAPHS, CABIN_MOSS_GRAPHS } from './cabinGraphs';
import { CAVE_SHAFT_GRAPHS } from './caveShaftGraphs';
import { CRAG_GRAPHS } from './cragGraphs';
import { FOREST_GRAPHS } from './forestGraphs';
import { HEARTH_GRAPHS } from './hearthGraphs';
import { KING_FX_GRAPHS } from './kingFxGraphs';
import { SKY_GRAPHS } from './skyGraphs';
import { SPRAY_GRAPHS } from './streamGraphs';
import { UNDER_GRAPHS } from './undergrowthGraphs';
import { RAIN_GRAPHS } from './weatherGraphs';
import { WATER_GRAPHS } from './waterGraphs';
import { WILDLIFE_GRAPHS } from './wildlifeGraphs';

/**
 * Every SF59 material graph Pine Hollow's runtime draws its own meshes in, by look.materials id (each built by its
 * ./*Graphs.ts): the cabin doors, roofs and stone, the hearth particles, the cave's shaft, the crags' granite, the
 * waterfall's spray, the water, the Antler King fight's fog wall and fallen-lantern flames, the rain's splashes and lens
 * drops and the forest floor's undergrowth. runtime/index.ts compiles them all before the streams build.
 */
export const PINE_GRAPHS: Readonly<Record<string, GraphIr>> = { ...CABIN_DOOR_GRAPHS, ...CABIN_MOSS_GRAPHS, ...HEARTH_GRAPHS, ...CAVE_SHAFT_GRAPHS, ...CRAG_GRAPHS, ...SPRAY_GRAPHS, ...KING_FX_GRAPHS, ...RAIN_GRAPHS, ...UNDER_GRAPHS, ...WATER_GRAPHS };

/** Pine's built look graphs (data/lookMaterials.generated.json, SHARD-PLATFORM W2c). */
export interface PineLookMaterials {
  /** the ids runtime/index.ts compiles before the streams build (PINE_GRAPHS) */
  readonly runtime: readonly string[];
  /** every look.materials graph the shardfile declares (shard.config.ts), by id */
  readonly graphs: Readonly<Record<string, GraphIr>>;
}

/**
 * The build's look.materials graphs (`src/sdk/bake/json.mjs` writes them to data/lookMaterials.generated.json): the
 * runtime's (above), the sky backdrop's (compiled by look/render.ts's keyed sky before the world stage), the forest's
 * (compiled by the trees' boot step, world/treeFactory.ts) and the small wildlife's (models/wildlife.ts). The shardfile
 * and the play code read the finished graphs as data; none of these builders ships.
 */
export function pineLookMaterials(): PineLookMaterials {
  return { runtime: Object.keys(PINE_GRAPHS), graphs: { ...PINE_GRAPHS, ...SKY_GRAPHS, ...FOREST_GRAPHS, ...WILDLIFE_GRAPHS } };
}

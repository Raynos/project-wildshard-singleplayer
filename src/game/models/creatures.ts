/**
 * Shared creatures (E306 / E315 M5; moved from the engine, E405, then out of the kit, SF54): one model per species rig, reusable — the red deer, the wild
 * boar and the bear. A level lists them in its roster with how IT makes them (`live(deer, { pipeline })`: lofted in code,
 * or the same rigs wearing TRELLIS.2 / Hunyuan3D-2 hulls, scripts/creature-rig-bake.mjs); the AnimalManager spawns and
 * animates the copies from the level's herd plans. The engine's `creature` helper says how a species becomes a model.
 */
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
// not on the engine index: it builds through AnimalFactory, which the node-safe manifests never load

const FILE = 'src/game/models/creatures.ts';

/** red deer: hinds, stags and their rare coats (the ghost stag, the great stag) */
export const deer: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/deer', file: FILE, pipeline: ['code', 'trellis', 'hunyuan'], ...creature('deer') });

/** wild boar: sows to the old boars, and the spawn-only variants a level asks for by name */
export const boar: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/boar', file: FILE, pipeline: ['code', 'hunyuan'], ...creature('boar', { spawnOnly: true }) });

/** black and brown bears, and their old ones */
export const bear: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/bear', file: FILE, pipeline: ['code', 'hunyuan'], ...creature('bear') });

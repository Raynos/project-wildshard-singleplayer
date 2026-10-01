/**
 * The creatures several shards spawn (E306 / E315 M5): one model per species rig, shared — the red deer, the wild boar
 * and the bear walk on Driftwood Isle (lofted in code, faceted) and in Pine Hollow (the same rigs wearing TRELLIS.2 /
 * Hunyuan3D-2 hulls, scripts/creature-rig-bake.mjs). Each shard lists them in its roster with how IT makes them
 * (`live(deer, { pipeline })`); the AnimalManager spawns and animates the copies from the shard's `fauna` herd plans.
 * The rigs, gaits, AI and coats are the species' (src/engine/entities/species/{deer,boar,bear}.ts); ./creature.ts says how a
 * species becomes a model.
 */
import { defineModel, type ModelDef } from './model';
import { creature, type CreatureParams } from './creature';

const FILE = 'src/engine/models/creatures.ts';

/** red deer: hinds, stags and their rare coats (the ghost stag, the great stag) */
export const deer: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/deer', file: FILE, pipeline: ['code', 'trellis', 'hunyuan'], ...creature('deer') });

/** wild boar: sows to Old Ironhide, and the Antler King's thrall (spawned by name in Pine Hollow) */
export const boar: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/boar', file: FILE, pipeline: ['code', 'hunyuan'], ...creature('boar', { spawnOnly: true }) });

/** black and brown bears, and their old ones (Old Blackpaw, the Grizzled Sow) */
export const bear: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'shared/bear', file: FILE, pipeline: ['code', 'hunyuan'], ...creature('bear') });

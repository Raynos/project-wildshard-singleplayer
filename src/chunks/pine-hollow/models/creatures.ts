/**
 * Pine Hollow's own creatures on the species rigs (E306 / E315 M5): the elk. The copies are the AnimalManager's, spawned
 * from the shard's `fauna` herd plans (src/chunks/pine-hollow.ts) and, as the Antler King's thralls, by his fight
 * (src/pinehollow/antlerKing.ts) and the old-growth at night (src/pinehollow/quest/nightThralls.ts). The deer, the boar
 * and the bear are shared (src/models/creatures.ts); the Antler King is ./antlerKing.ts, the birds ./birds.ts, the hare
 * ./wildlife.ts.
 */
import { defineModel, type ModelDef } from '../../../models/model';
import { creature, type CreatureParams } from '../../../models/creature';

/** the elk: cows, bulls and their rare coats (the royal bull, the pale elk, the imperial bull), and the King's thrall —
 *  the Hunyuan3D-2 hulls (elk-cow / elk-bull[.phone].rigged.glb, src/entities/pineCreatures.ts) on the elk's code rig
 *  (src/entities/species/elk.ts), which is also the fallback when Debug ▸ Creatures = Procedural */
export const elk: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'pine-hollow/elk', file: 'src/chunks/pine-hollow/models/creatures.ts', pipeline: ['hunyuan', 'code'], ...creature('elk', { spawnOnly: true }) });

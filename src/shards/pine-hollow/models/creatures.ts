/**
 * Pine Hollow's own creatures on the species rigs (E306 / E315 M5): the elk. The copies are the AnimalManager's, spawned
 * from the shard's `fauna` herd plans (src/shards/pine-hollow/manifest.ts) and, as the Antler King's thralls, by his fight
 * (src/shards/pine-hollow/combat/antlerKing.ts) and the old-growth at night (src/shards/pine-hollow/quest/nightThralls.ts). The deer, the boar
 * and the bear are shared (src/game/models/creatures.ts); the Antler King is ./antlerKing.ts, the birds ./birds.ts, the hare
 * ./wildlife.ts.
 */
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';

/** the elk: cows, bulls and their rare coats (the royal bull, the pale elk, the imperial bull), and the King's thrall —
 *  the Hunyuan3D-2 hulls (elk-cow / elk-bull[.phone].rigged.glb, src/engine/entities/pineCreatures.ts) on the elk's code rig
 *  (src/engine/entities/species/elk.ts), which is also the fallback when Debug ▸ Creatures = Procedural */
export const elk: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'pine-hollow/elk', file: 'src/shards/pine-hollow/models/creatures.ts', pipeline: ['hunyuan', 'code'], ...creature('elk', { spawnOnly: true }) });

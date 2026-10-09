/**
 * Driftwood Isle's own creatures (E306 / E315 M5) — the island's enemies on the species rigs, all lofted in code in the
 * faceted low-poly style but the Drowned Captain, and the gulls. The copies are spawned and driven by the island:
 * src/shards/driftwood-isle/creatures/Enemies.ts (reef crabs at the tidepools, coconut monkeys in the palm groves, the Drowned Sailor in the
 * wreck's hold), the finale (src/shards/driftwood-isle/quest/Finale.ts: the Captain, once the altar is used), src/shards/driftwood-isle/world/Gulls.ts (the
 * gulls, one instanced draw, wings in the vertex shader). The deer, boar and bear are shared (src/game/models/creatures.ts).
 */
import * as THREE from 'three';
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { Gulls } from '../world/Gulls';

const FILE = 'src/shards/driftwood-isle/models/creatures.ts';

/** the reef crab (custom rig: claws, legs; its shell halves a hit from the front), small and big */
export const reefCrab: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/reef-crab', file: FILE, pipeline: 'code', ...creature('crab') });

/** the coconut monkey (custom rig: perches in the palm crowns, throws coconuts) and its grey elder */
export const coconutMonkey: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/coconut-monkey', file: FILE, pipeline: 'code', ...creature('monkey') });

/** the Drowned Sailor (a humanoid custom rig): rises through the wreck's broken deck at night */
export const drownedSailor: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/drowned-sailor', file: FILE, pipeline: 'code', ...creature('sailor') });

/** the Drowned Captain, the island's boss: a Hunyuan3D-2 mesh (public/assets/models/driftwood-hero/captain/captain.glb,
 *  src/engine/entities/species/captainMesh.ts) bound to the sailor's humanoid rig as it loads; a code stand-in until it has */
export const drownedCaptain: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/drowned-captain', file: FILE, pipeline: ['hunyuan', 'code'], ...creature('captain') });

/** the herring gull: one faceted gull of src/shards/driftwood-isle/world/Gulls.ts (perched, wings folded) — the island's flocks are one
 *  instanced draw of ~36, their wings, head and legs posed in its vertex shader */
export const gull: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/gull', name: 'Herring gull', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: {},
  build: (ctx) => new Gulls(ctx.sky).build({ perches: [new THREE.Vector3(0, 0, 0)], centre: new THREE.Vector3(0, 0, 0), radius: 1, count: 1 }).group,
});

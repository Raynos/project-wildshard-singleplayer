/**
 * Driftwood Isle's own creatures (E306 / E315 M5) — the island's enemies on the species rigs, all lofted in code in the
 * faceted low-poly style but the Drowned Captain, and the gulls. The copies are spawned and driven by the island:
 * src/shards/driftwood-isle/creatures/Enemies.ts (reef crabs at the tidepools, coconut monkeys in the palm groves, the Drowned Sailor in the
 * wreck's hold), the finale (src/shards/driftwood-isle/runtime/finalePresentation.ts: the Captain, once the altar is used), src/shards/driftwood-isle/world/Gulls.ts (the
 * gulls, one instanced draw, wings in the vertex shader). The deer, boar and bear are shared (src/game/models/creatures.ts).
 */
import type * as THREE from 'three';
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { gullFlock } from '../world/Gulls';
import { fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

const FILE = 'src/shards/driftwood-isle/runtime/models/creatures.ts';

/** the reef crab (custom rig: claws, legs; its shell halves a hit from the front), small and big */
export const reefCrab: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/reef-crab', file: FILE, pipeline: 'code', ...creature('crab') });

/** the coconut monkey (custom rig: perches in the palm crowns, throws coconuts) and its grey elder */
export const coconutMonkey: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/coconut-monkey', file: FILE, pipeline: 'code', ...creature('monkey') });

/** the Drowned Sailor (a humanoid custom rig): rises through the wreck's broken deck at night */
export const drownedSailor: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/drowned-sailor', file: FILE, pipeline: 'code', ...creature('sailor') });

/** the Drowned Captain, the island's boss: a Hunyuan3D-2 mesh (public/assets/models/driftwood-hero/captain/captain.glb,
 *  ../species/captainMesh.ts) bound to the sailor's humanoid rig, code eye spheres on top; no stand-in (a build refuses
 *  before the file loads) */
export const drownedCaptain: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'driftwood-isle/drowned-captain', file: FILE, pipeline: ['hunyuan', 'code'], ...creature('captain') });

/** the herring gull: one faceted gull of src/shards/driftwood-isle/world/Gulls.ts (perched, wings folded) — the island's flocks are one
 *  instanced draw of ~36, their wings, head and legs posed in its vertex shader */
export const gull: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/gull', name: 'Herring gull', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: {},
  // the baked gull (generators/gull.ts) is a fixed-model template: a loading box until the island's templates are in
  build: () => {
    const one = (): THREE.Object3D => gullFlock([{ x: 0, y: 0, z: 0 }], 1).group;
    if (fixedGeometryReady()) return one();
    return loadingSpecimen('driftwood-isle/gull', [0.95, 0.3, 0.9], async () => { await loadFixedGeometry(); return one(); });
  },
});

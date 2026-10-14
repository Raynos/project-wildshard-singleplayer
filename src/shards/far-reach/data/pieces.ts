import { FALLEN_BRIDGE, MILL, NOTES, STEP, VANES, WINCH, WINCH_HOUSE } from './layout';
import { STRINGS } from './strings';
import { SKY_GROUND } from './groundScene.generated';

const FILE = 'src/shards/far-reach/world/build.ts';
/**
 * Sky Reach's world pieces as the world registry lists them (G345): the far isles, the pines and the meadow, the updraft
 * ramp (solid only under the board), the fallen crown bridge, the windmill, the winch, the keeper's notes and his stand,
 * the three vanes, the crown arena, and the winch house and the Roost's nest drawn straight from the bake.
 */
export const SKY_PIECES = [
  ...SKY_GROUND.registry,
  { id: 'far.sky-isles', name: STRINGS.skyIsles, category: 'props', file: FILE },
  { id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE },
  { id: 'far.dressing', name: STRINGS.meadow, category: 'props', file: FILE },
  { id: 'far.updraft', name: STRINGS.updraft, category: 'buildings', file: FILE, surface: 'wood', mode: 'board' },
  { id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, surface: 'wood' },
  { id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, surface: 'stone', at: [MILL.x, 30, MILL.z], yaw: MILL.yaw },
  { id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, surface: 'wood', at: [WINCH.x, WINCH.y, WINCH.z] },
  { id: 'far.notes', name: STRINGS.notesName, category: 'props', file: FILE, surface: 'wood', at: [NOTES.x, NOTES.y, NOTES.z], yaw: 0.6 },
  { id: 'far.keeper.stand', name: STRINGS.notesName, category: 'props', file: FILE, surface: 'wood' },
  ...VANES.map((v) => ({ id: `far.vane.${v.id}`, name: STRINGS.vane, category: 'props', file: FILE, surface: 'wood', at: [v.x, v.y, v.z] } as const)),
  { id: 'far.crown.ruin', name: STRINGS.crown, category: 'buildings', file: FILE, surface: 'stone' },
  { id: 'far.step.winch-house', name: STRINGS.winch, category: 'buildings', file: FILE, surface: 'stone', baked: 'winch-house', at: [WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z], node: 'far.step.winch-house' },
  { id: 'far.roost.nest', name: STRINGS.roost, category: 'props', file: FILE, surface: 'wood', baked: 'roost', node: 'far.roost.nest' },
] as const;

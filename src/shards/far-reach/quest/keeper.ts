import { pivotNpc, type PivotNpc } from '@wildshard/game/plugin/geometry';
import { skyHd } from '../world/meshes';
import { skyMappedLook } from '../world/looks';
import { SPAWN } from '../data/layout';
import { KEEPER_AT } from '../data/quests';
import source from '../shard.config';

/**
 * His book stand and lantern (E399, mockup B): a step behind him and to his right as the spawn sees him, outside the
 * views down the bridge's axis, its book turned to the spawn.
 */
const STAND_X = KEEPER_AT.x + 0.5, STAND_Z = KEEPER_AT.z - 1.2;
export const KEEPER_STAND = { x: STAND_X, z: STAND_Z, yaw: Math.atan2(SPAWN.x - STAND_X, SPAWN.z - STAND_Z) } as const;

/**
 * The bridge-keeper (mockup B: an old sky-sailor in a slate-blue coat and hat, a rust-brown scarf, a long white beard, a
 * satchel, a gnarled staff) on the deck at `y`: the shared pivot NPC host's figure and motion from his row
 * (data/keeperLook.ts) in his painted material. Not loaded: no figure, his talk anchor still stands.
 */
export function keeper(y: number): PivotNpc {
  const row = source.questNpcs?.find(binding => binding.npc.id === 'far.keeper')?.npc;
  if (row === undefined) throw new Error('Undeclared quest NPC far.keeper');
  const made = skyHd('keeper-hd');
  if (made !== null) {
    made.geometry.dispose();
    if (made.pivots === undefined) throw new Error('Missing authored keeper pivots');
  }
  // his painted material, its scarf and sash a warm rust-brown (council: 'the keeper's red scarf reads louder than the mockup's brown one')
  return pivotNpc(row, made?.pivots ?? null, () => y, made === null ? undefined : skyMappedLook('keeper-scarf', made.map));
}

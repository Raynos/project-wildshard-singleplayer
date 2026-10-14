import { SPAWN } from './layout';
import { KEEPER_AT } from './quests';

const x = KEEPER_AT.x + 0.5, z = KEEPER_AT.z - 1.2;
/** The authored book stand behind the keeper, facing the spawn. */
export const KEEPER_STAND = { x, z, yaw: Math.atan2(SPAWN.x - x, SPAWN.z - z) } as const;

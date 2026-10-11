import { CROWN, GROVE, KEEPER, ROOST, RUIN, STEP, SUNREST, WINDMILL } from './layout';
import { STRINGS } from './strings';

/**
 * The named places (loop 6, as the other shards: "DISCOVERED · <place>" as you arrive, pins on the full map, and the last
 * one reached is where a fall puts you back, E295). Each sits on its island's deck, clear of the structures on it.
 */
export const SKY_PLACES = [
  { id: 'far.sunrest', label: STRINGS.sunrest, x: SUNREST.x, y: SUNREST.y, z: SUNREST.z, r: 12, quiet: true },
  { id: 'far.windmill', label: STRINGS.windmill, x: WINDMILL.x, y: WINDMILL.y, z: WINDMILL.z, r: 11 },
  { id: 'far.grove', label: STRINGS.grove, x: GROVE.x, y: GROVE.y, z: GROVE.z, r: 9 },
  { id: 'far.roost', label: STRINGS.roost, x: ROOST.x - 4, y: ROOST.y, z: ROOST.z - 2, r: 10 },
  { id: 'far.keeper', label: STRINGS.keeper, x: KEEPER.x, y: KEEPER.y, z: KEEPER.z, r: 9 },
  { id: 'far.ruin', label: STRINGS.ruin, x: RUIN.x, y: RUIN.y, z: RUIN.z, r: 10 },
  { id: 'far.step', label: STRINGS.step, x: STEP.x, y: STEP.y, z: STEP.z, r: 10 },
  { id: 'far.crown', label: STRINGS.crown, x: CROWN.x, y: CROWN.y, z: CROWN.z, r: 15 },
] as const;

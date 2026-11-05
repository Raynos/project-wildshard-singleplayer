import type { PlayerSim } from '../sim/playerSim';
import { ANIMAL_NET, type AnimalNetView } from './animalNet';
import { ENCOUNTER_NET, type EncounterNetView } from './encounterNet';
import { NET_EVENT_FORMS } from './messages';
import { PLAYER_NET } from './playerNet';
import { compileSchema, netSchemaHash, schemaDescription, type NetClass } from './schema';

/** The compiled `player` class. */
export const PLAYER_CLASS: NetClass<PlayerSim> = compileSchema(PLAYER_NET, 0);
/** The compiled `animal` class. */
export const ANIMAL_CLASS: NetClass<AnimalNetView> = compileSchema(ANIMAL_NET, 1);
/** The compiled `encounter` class. */
export const ENCOUNTER_CLASS: NetClass<EncounterNetView> = compileSchema(ENCOUNTER_NET, 2);
/** Every class by wire id. A class's view type is erased here: the wire only needs its columns. */
export const NET_CLASSES: readonly NetClass<never>[] = [PLAYER_CLASS, ANIMAL_CLASS, ENCOUNTER_CLASS];
/** Exact wire identity, checked at `hello`: client and server always ship from one engine build (J54). */
export const NET_SCHEMA_HASH: number = netSchemaHash([schemaDescription(PLAYER_NET), schemaDescription(ANIMAL_NET), schemaDescription(ENCOUNTER_NET), NET_EVENT_FORMS]);

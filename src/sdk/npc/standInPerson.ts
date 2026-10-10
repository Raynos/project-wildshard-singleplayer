import { standInPerson as platformStandInPerson, type StandInPerson as PlatformStandInPerson, type StandInPersonRow as PlatformStandInPersonRow, type StandInPersonSpec as PlatformStandInPersonSpec, type StandInRig as PlatformStandInRig } from '@wildshard/game/systems/npc/standInPerson';

/** A standing person's numbers (a shard's data row): collider, talk height, draw bands, notice radius, walk, flame, point and sway (SHARD-PLATFORM M3, the npc system). */
export type StandInPersonRow = PlatformStandInPersonRow;
/** The rigged person a stand-in gives way to. */
export type StandInRig = PlatformStandInRig;
/** One person to stand up: where, its stand-in parts and materials, its rig source and where it points. */
export type StandInPersonSpec = PlatformStandInPersonSpec;
/** A standing person's handle: group, talk point, collider, talking, update, lod, walkTo. */
export type StandInPerson = PlatformStandInPerson;
/** Stands a person up: the stand-in, swapped for the rig on the first frame it is ready; faces you, talks, points, walks. */
export const standInPerson: typeof platformStandInPerson = platformStandInPerson;

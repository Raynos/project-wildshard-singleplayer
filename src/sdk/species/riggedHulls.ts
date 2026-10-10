import { riggedHulls as platformRiggedHulls, type RiggedHullUrls as PlatformRiggedHullUrls, type RiggedHulls as PlatformRiggedHulls } from '@wildshard/game/systems/looks/riggedHulls';

/** Where a rigged-hull family's files are: a hull's rig for this tier, and a baked coat's KTX2 table key. */
export type RiggedHullUrls = PlatformRiggedHullUrls;
/** A shard's live rigged-hull family: preload, skin (a species look's hooks) and the coat bake's sources. */
export type RiggedHulls = PlatformRiggedHulls;
/** A shard's generated creature hulls, pre-skinned to the species' skeletons, in per-variant coats (SHARD-PLATFORM M3). */
export const riggedHulls: typeof platformRiggedHulls = platformRiggedHulls;

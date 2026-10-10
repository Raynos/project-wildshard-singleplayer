import { BakedBuildingAssembly as PlatformBakedBuildingAssembly, NO_BUILDING_OWNER as PLATFORM_NO_BUILDING_OWNER, type BakedBuildingGeometries as PlatformBakedBuildingGeometries, type BakedBuildingInput as PlatformBakedBuildingInput, type BakedBuildingLight as PlatformBakedBuildingLight, type BakedBuildingLook as PlatformBakedBuildingLook, type BakedBuildingMats as PlatformBakedBuildingMats, type BakedBuildingNode as PlatformBakedBuildingNode, type BakedBuildingOwner as PlatformBakedBuildingOwner, type BakedBuildingRecord as PlatformBakedBuildingRecord, type BakedBuildingRole as PlatformBakedBuildingRole, type BakedBuildingTier as PlatformBakedBuildingTier } from '@wildshard/game/systems/props/bakedBuilding';

/** A light as a baked building record holds it (SHARD-PLATFORM M3, the props system). */
export type BakedBuildingLight = PlatformBakedBuildingLight;
/** A fitting a baked building adds to its root: a door, glow, fire pit, particle cloud, hung lantern, wheel or light. */
export type BakedBuildingNode<P extends string> = PlatformBakedBuildingNode<P>;
/** One building as its bake wrote it: parts per kit material, glass, fittings, boxes, solids, floors and rooms. */
export type BakedBuildingRecord<K extends string, P extends string> = PlatformBakedBuildingRecord<K, P>;
/** How a shard's baked buildings dress and band (a shard's data row). */
export type BakedBuildingLook<K extends string = string> = PlatformBakedBuildingLook<K>;
/** The tier's settings a baked building reads, live. */
export type BakedBuildingTier = PlatformBakedBuildingTier;
/** The materials a baked building draws with. */
export type BakedBuildingMats<K extends string, P extends string> = PlatformBakedBuildingMats<K, P>;
/** A geometry pack read by index. */
export type BakedBuildingGeometries = PlatformBakedBuildingGeometries;
/** What a baked building hands its owner as it is assembled. */
export type BakedBuildingOwner = PlatformBakedBuildingOwner;
/** Drawn alone, welded into a settlement's unit, or a viewer's specimen. */
export type BakedBuildingRole = PlatformBakedBuildingRole;
/** Everything a baked building is assembled from. */
export type BakedBuildingInput<K extends string, P extends string> = PlatformBakedBuildingInput<K, P>;
/** The owner that keeps nothing (a specimen's). */
export const NO_BUILDING_OWNER: PlatformBakedBuildingOwner = PLATFORM_NO_BUILDING_OWNER;
/** A baked building assembled where it stands: its root and fittings, its weld parts in bands, its live parts handed on. */
export const BakedBuildingAssembly: typeof PlatformBakedBuildingAssembly = PlatformBakedBuildingAssembly;
/** A baked building (the instance type). */
export type BakedBuildingView<K extends string, P extends string> = PlatformBakedBuildingAssembly<K, P>;

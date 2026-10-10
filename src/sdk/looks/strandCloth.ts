import { ClothSheet as PlatformClothSheet, StrandTassel as PlatformStrandTassel, clothHash as platformClothHash, clothPenetration as platformClothPenetration, type ClothAttributes as PlatformClothAttributes, type ClothBreeze as PlatformClothBreeze, type ClothCapsule as PlatformClothCapsule, type ClothSheetRow as PlatformClothSheetRow, type StrandTasselRow as PlatformStrandTasselRow } from '@wildshard/game/systems/looks/strandCloth';

/** A capsule the cloth may not enter. */
export type ClothCapsule = PlatformClothCapsule;
/** A noise push as data. */
export type ClothBreeze = PlatformClothBreeze;
/** The dynamic attributes the cloth rewrites. */
export type ClothAttributes = PlatformClothAttributes;
/** A tassel as data. */
export type StrandTasselRow = PlatformStrandTasselRow;
/** A hanging sheet as data. */
export type ClothSheetRow = PlatformClothSheetRow;
/** A Verlet tassel on a held item (SHARD-PLATFORM M3, strand cloth). */
export const StrandTassel: typeof PlatformStrandTassel = PlatformStrandTassel;
/** A Verlet sheet hung from a cord on a held item. */
export const ClothSheet: typeof PlatformClothSheet = PlatformClothSheet;
/** How deep any point sits inside any capsule. */
export const clothPenetration: typeof platformClothPenetration = platformClothPenetration;
/** A stable per-index hash in [0, 1). */
export const clothHash: typeof platformClothHash = platformClothHash;

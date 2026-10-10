import { registerSignCopies as platformRegisterSignCopies, signParts as platformSignParts, type SignModelLook as PlatformSignModelLook, type SignModelParams as PlatformSignModelParams, type SignModelRow as PlatformSignModelRow, type SignVariantRow as PlatformSignVariantRow } from '@wildshard/game/systems/signs/signModel';

/** A sign copy's params: its style, words, colours, size, faces, board and gain. */
export type SignModelParams<S extends string = string> = PlatformSignModelParams<S>;
/** A sign model's variant as data. */
export type SignVariantRow<S extends string = string> = PlatformSignVariantRow<S>;
/** The sign model as data (key, calligraphy style and gains, sideways styles, depths, variants, piece ids). */
export type SignModelRow = PlatformSignModelRow;
/** What the sign model draws with: the SDF calligraphy and the sign atlas. */
export type SignModelLook<S extends string = string> = PlatformSignModelLook<S>;
/** One sign alone, facing +z: its calligraphy board and tubes or its atlas quad (SHARD-PLATFORM M3). */
export const signParts: typeof platformSignParts = platformSignParts;
/** Register a builder's hung signs as copies of the sign model where they are drawn (SHARD-PLATFORM M3). */
export const registerSignCopies: typeof platformRegisterSignCopies = platformRegisterSignCopies;

import { braidColours as platformBraidColours, coilPoints as platformCoilPoints, LashCord as PlatformLashCord, plaitedCord as platformPlaitedCord, plaitTextures as platformPlaitTextures, type CoilPath as PlatformCoilPath, type CordRgb as PlatformCordRgb, type CordStyle as PlatformCordStyle, type PlaitStyle as PlatformPlaitStyle } from '@wildshard/game/systems/items/lashView';

/** RGB, linear. */
export type CordRgb = PlatformCordRgb;
/** A cord's braid: segments, sides, the two strands, the popper and its rings, roughness and self-light. */
export type CordStyle = PlatformCordStyle;
/** The plait tile: texels, strand columns and rows, crease / crown colours, relief and roughness. */
export type PlaitStyle = PlatformPlaitStyle;
/** A held coil's path: the handle's top, the ellipse, its turns and step, and the fall. */
export type CoilPath = PlatformCoilPath;
/** The lash item's thrown cord (SHARD-PLATFORM SF72, a declared item view): one braided tube laid along a moving curve. */
export const LashCord: typeof PlatformLashCord = PlatformLashCord;
/** A built thrown cord (its mesh, and `shape` to lay it each frame). */
export type LashCordView = PlatformLashCord;
/** Paints a tube's rings with the plait's two strands, the last rings the popper. */
export const braidColours: typeof platformBraidColours = platformBraidColours;
/** The plait tile's map, normal and roughness textures, made in code. */
export const plaitTextures: typeof platformPlaitTextures = platformPlaitTextures;
/** A held coil's centre line from its path row. */
export const coilPoints: typeof platformCoilPoints = platformCoilPoints;
/** A plaited cord along a centre line, the plait tile laid along it. */
export const plaitedCord: typeof platformPlaitedCord = platformPlaitedCord;

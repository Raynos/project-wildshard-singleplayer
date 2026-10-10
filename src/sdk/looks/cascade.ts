import { Cascade as PlatformCascade, type CascadeGlsl as PlatformCascadeGlsl, type CascadeLike as PlatformCascadeLike, type CascadeSpec as PlatformCascadeSpec } from '@wildshard/game/systems/looks/cascade';

/** A cascade's programs as GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type CascadeGlsl = PlatformCascadeGlsl;
/** Where a cascade pours, how wide, its terraces, its GLSL rows and its fog patch id. */
export type CascadeSpec = PlatformCascadeSpec;
/** What a caller keeps of a cascade: its group, build and per-frame update. */
export type CascadeLike = PlatformCascadeLike;
/** A toon cascade: a stepped faceted curtain, foam rings on its pool and boiling foam puffs, from the shard's GLSL rows. */
export const Cascade: typeof PlatformCascade = PlatformCascade;

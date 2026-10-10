import { installMossOverlay as platformInstallMossOverlay, type MossOverlay as PlatformMossOverlay } from '@wildshard/game/systems/looks/mossOverlay';

/** One moss overlay: its patch id and program key, the sun, strength, up-only switch and GLSL edits (SHARD-PLATFORM M3, the looks system). */
export type MossOverlay = PlatformMossOverlay;
/** Patches a moss / lichen overlay into a standard material; every strength shares one program. */
export const installMossOverlay: typeof platformInstallMossOverlay = platformInstallMossOverlay;

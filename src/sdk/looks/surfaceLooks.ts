import { applySurfaceLooks as platformApplySurfaceLooks, type DesaturateLook as PlatformDesaturateLook, type FirelightLook as PlatformFirelightLook, type LeatherLook as PlatformLeatherLook, type StoneBandLook as PlatformStoneBandLook, type SurfaceInputs as PlatformSurfaceInputs, type SurfaceLook as PlatformSurfaceLook, type SurfaceRgb as PlatformSurfaceRgb, type ViewerLightLook as PlatformViewerLightLook } from '@wildshard/game/systems/looks/surfaceLooks';

/** RGB, linear. */
export type SurfaceRgb = PlatformSurfaceRgb;
/** Burning fires warm the surface within a reach. */
export type FirelightLook = PlatformFirelightLook;
/** The eye's own light on a held part, and a glancing sheen. */
export type ViewerLightLook = PlatformViewerLightLook;
/** Leather creases and grain in model space, as albedo and bump. */
export type LeatherLook = PlatformLeatherLook;
/** Rows of fieldstones below a model height. */
export type StoneBandLook = PlatformStoneBandLook;
/** The map's colour pulled toward its luma. */
export type DesaturateLook = PlatformDesaturateLook;
/** One declared surface look (SHARD-PLATFORM SF72, look-family rows). */
export type SurfaceLook = PlatformSurfaceLook;
/** The shared live inputs a row may read: the fires' light slots and the dusk. */
export type SurfaceInputs = PlatformSurfaceInputs;
/** Chains a shard's surface-look rows onto a standard material, in order. */
export const applySurfaceLooks: typeof platformApplySurfaceLooks = platformApplySurfaceLooks;

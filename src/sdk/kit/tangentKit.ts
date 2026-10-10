import { AXIS_X as platformAxisX, AXIS_Y as platformAxisY, AXIS_Z as platformAxisZ, TangentKit as PlatformTangentKit, type TangentLook as PlatformTangentLook } from '@wildshard/game/systems/kit/tangentKit';

/** How a tangent-kit face looks: its wash (and top wash), pattern kind and two parameters, emit, line weight and edge bits. */
export type TangentLook = PlatformTangentLook;
/** A builder of ruled faces that carry their u direction, packed for merged and instanced drawing (SHARD-PLATFORM M3, the kit system). */
export const TangentKit: typeof PlatformTangentKit = PlatformTangentKit;
/** A tangent kit (the instance type; extend TangentKit to name your own). */
export type TangentKitView = PlatformTangentKit;
/** The world x axis (shared, never mutate it). */
export const AXIS_X: typeof platformAxisX = platformAxisX;
/** The world up axis (shared, never mutate it). */
export const AXIS_Y: typeof platformAxisY = platformAxisY;
/** The world z axis (shared, never mutate it). */
export const AXIS_Z: typeof platformAxisZ = platformAxisZ;

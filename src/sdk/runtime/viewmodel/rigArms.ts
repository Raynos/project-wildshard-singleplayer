import {
  RigArms as PlatformRigArms, swordArmsOf as platformSwordArmsOf, vmScale as platformVmScale, VM_FOV as PLATFORM_VM_FOV,
  type RigMeta as PlatformRigMeta, type RigState as PlatformRigState, type VmFrame as PlatformVmFrame,
} from '@wildshard/game/systems/viewmodel/rigArms';

/** A baked first-person arm rig played on two clip channels (or its swim loops); the owner supplies the GLB, contract and bake. */
export type RigArmsInstance = PlatformRigArms;
/** The one platform arm player; the SDK owns no second parse cache, mixer or channel implementation. */
export const RigArms: typeof PlatformRigArms = PlatformRigArms;
/** The rig's clip metadata (side, loop, timing), blade spans and optional water line, read from its root extras. */
export type RigMeta = PlatformRigMeta;
/** Per-frame walk speed, step phase and look velocity driving the arm player. */
export type RigState = PlatformRigState;
/** The viewmodel's camera-space framing: size, pitch, yaw and roll about the eye. */
export type VmFrame = PlatformVmFrame;
/** The clips' canonical vertical field of view in degrees. */
export const VM_FOV: typeof PLATFORM_VM_FOV = PLATFORM_VM_FOV;
/** The root x / y scale that draws a rig framed for the viewmodel field through a wider world camera. */
export const vmScale: typeof platformVmScale = platformVmScale;
/** Adapt a rig to the trusted sword family's animated-arms port with the owner's offset, framing and sky setup. */
export const swordArmsOf: typeof platformSwordArmsOf = platformSwordArmsOf;

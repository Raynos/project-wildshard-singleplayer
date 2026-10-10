import {
  installGrappleAim as platformInstallGrappleAim,
  type GrappleAimCourse as PlatformGrappleAimCourse, type GrappleAimCue as PlatformGrappleAimCue, type GrappleAimEvents as PlatformGrappleAimEvents,
  type GrappleAimLaw as PlatformGrappleAimLaw, type GrappleAimRow as PlatformGrappleAimRow, type GrappleAimRules as PlatformGrappleAimRules,
  type GrappleAimTarget as PlatformGrappleAimTarget, type GrappleAimView as PlatformGrappleAimView,
} from '@wildshard/game/systems/tools/grappleAim';

/** A grapple tool's presentation as data: its hints, chip, markers, toasts, line, FX, system ids and mesh names. */
export type GrappleAimRow = PlatformGrappleAimRow;
/** The aim: an eye, a screen projection and the look direction. */
export type GrappleAimView = PlatformGrappleAimView;
/** A course: the hooks the claw may bite. */
export type GrappleAimCourse = PlatformGrappleAimCourse;
/** A locked target: at least the hook it bit. */
export type GrappleAimTarget = PlatformGrappleAimTarget;
/** The law's phase changes the view follows. */
export type GrappleAimEvents = PlatformGrappleAimEvents;
/** The caller's grapple law, as the view reads it. */
export type GrappleAimLaw<C extends GrappleAimCourse, T extends GrappleAimTarget> = PlatformGrappleAimLaw<C, T>;
/** A sound the view plays at a law event. */
export type GrappleAimCue = PlatformGrappleAimCue;
/** What only the caller knows: its course, law, sight and landing tests, traversal and sounds. */
export type GrappleAimRules<C extends GrappleAimCourse, T extends GrappleAimTarget, S, L extends GrappleAimLaw<C, T> = GrappleAimLaw<C, T>> = PlatformGrappleAimRules<C, T, S, L>;
/** A grapple tool's aim, line and zip view: reach markers, the LOCK / ZIP relabel, the rope, the claw and its FX (SHARD-PLATFORM M3). */
export const installGrappleAim: typeof platformInstallGrappleAim = platformInstallGrappleAim;

import {
  HookCoursePlayground as PlatformHookCoursePlayground, hookCourseHooks as platformHookCourseHooks, hookCoursePad as platformHookCoursePad,
  hookCoursePadLabelAt as platformHookCoursePadLabelAt,
  type HookCourseCourse as PlatformHookCourseCourse, type HookCourseHook as PlatformHookCourseHook, type HookCoursePad as PlatformHookCoursePad,
  type HookCourseHooks as PlatformHookCourseHooks, type HookCourseRing as PlatformHookCourseRing, type HookCourseRow as PlatformHookCourseRow, type HookCourseTool as PlatformHookCourseTool,
} from '@wildshard/game/systems/tools/hookCourse';

/** A course as data: the room, the pads, the hooks, the run, the piece it registers, its words and colours. */
export type HookCourseRow = PlatformHookCourseRow;
/** A pad of the course, in the room's own frame. */
export type HookCoursePad = PlatformHookCoursePad;
/** A hook as data: a ring on a pad's lip. */
export type HookCourseRing = PlatformHookCourseRing;
/** A hook placed: its pad and its ring's centre in the room's frame. */
export type HookCourseHook = PlatformHookCourseHook;
/** What a course hands the tool: its name and the rings' centres, world space. */
export type HookCourseCourse = PlatformHookCourseCourse;
/** The tool that bites the course's hooks while the room is open. */
export type HookCourseTool = PlatformHookCourseTool;
/** What only the caller has: the tool that bites the hooks and the run clock (ms). */
export type HookCourseHooks = PlatformHookCourseHooks;
/** A grapple tool's practice course: a dev-grid room of pads and hooks from a data row, timed (SHARD-PLATFORM M3). */
export const HookCoursePlayground: typeof PlatformHookCoursePlayground = PlatformHookCoursePlayground;
/** A course playground (the instance type). */
export type HookCoursePlaygroundView = PlatformHookCoursePlayground;
/** A pad of the row by id (throws on an unknown one). */
export const hookCoursePad: typeof platformHookCoursePad = platformHookCoursePad;
/** The row's hooks placed on their pads' lips. */
export const hookCourseHooks: typeof platformHookCourseHooks = platformHookCourseHooks;
/** Where a pad's name sits on the full map. */
export const hookCoursePadLabelAt: typeof platformHookCoursePadLabelAt = platformHookCoursePadLabelAt;

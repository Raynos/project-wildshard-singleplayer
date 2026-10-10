/**
 * Nine Dragon ▸ Grapple playground (E307, Jake: "a really simple developer level … an acrobatic course for the grappling
 * hook, a custom parkour level to get a feel for the grappling hook and how it works"). The SDK's hook course
 * (@wildshard/sdk/tools/hookCourse) over data/grappleCourse.ts: a start pad, pads over a pit, a long drop, a tower climbed
 * by three chained hooks to a FINISH cap, and a range line off the start (6 · 14 · 24 · 34 m).
 *
 * The REAL Fei Zhua: the room hands the grapple its own course (grapple/course.ts `setGrappleCourse`) — the same LOCK →
 * GRAPPLE / JUMP → ZIP relabel, markers, rope and FX, on these hooks only.
 */
import type { PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import { HookCoursePlayground } from '@wildshard/sdk/tools/hookCourse';
import { FeiZhua } from '../grapple/FeiZhua';
import { GRAPPLE_COURSE } from '../data/grappleCourse';

/** The grapple course, played with the equipped Fei Zhua. */
export class GrapplePlayground extends HookCoursePlayground {
  constructor(host: PlaygroundHost) {
    super(host, GRAPPLE_COURSE, {
      tool: () => {
        const tool = host.game.app.equipment?.tools.find((item) => item instanceof FeiZhua);
        if (!(tool instanceof FeiZhua)) throw new Error('Grapple playground needs the Fei Zhua');
        return tool;
      },
      now: () => performance.now(),
    });
  }
}

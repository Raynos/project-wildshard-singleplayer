import type { NpcFigureMotionProfile } from '@wildshard/game/systems/npc/figureMotion';
import { CAMP_PEOPLE } from './quest';
import { peopleModelUrl } from './campPeopleModels';
import type { NpcFigureFrame as PersonFrame } from '@wildshard/game/systems/npc/figureRig';

export interface CampPersonProfile {
  id: keyof typeof CAMP_PEOPLE; model: string; frame: PersonFrame; motion: NpcFigureMotionProfile;
  phase: number; glanceAfter: number; collider: { height: number; radius: number };
}
/** Authored idle secondary motion; the shared NPC rig owns focus and talking. */
export const CAMP_MOTION: Record<keyof typeof CAMP_PEOPLE, NpcFigureMotionProfile> = {
  elder: {}, herderGate: {}, herderRail: {},
  child: {
    orbit: { x: CAMP_PEOPLE.child.x, z: CAMP_PEOPLE.child.z, radius: 2.3, speed: 0.55, stopDistance: 5, lift: 0.1, frequency: 6.5 },
    idleHead: { distance: 5, yaw: 0, pitch: -0.1 },
    idleArm: { distance: 5, x: { offset: 0, amplitude: 0.6, frequency: 6.5, clock: 'phase' } },
  },
  cook: {
    idleHead: { distance: 3, yaw: -0.35, pitch: 0.35 },
    idleArm: { distance: 3, x: { offset: -0.75, amplitude: 0.14, frequency: 2.4, clock: 'time' },
      z: { offset: -0.2, amplitude: 0.14, frequency: 2.4, clock: 'time', cosine: true } },
  },
};

/** Per-person content rows share the rig's focus and talking clips. */
export function campPersonProfile(id: keyof typeof CAMP_PEOPLE, frame: PersonFrame, radius: number, index: number): CampPersonProfile {
  return { id, model: peopleModelUrl(id), frame, motion: CAMP_MOTION[id], phase: index * 1.7, glanceAfter: 2 + index,
    collider: { height: frame.height, radius } };
}


import { Vector3 } from 'three';
import { castSegment, lineOfSight } from '@wildshard/engine/physics/query';
import type { GrappleCourse, GrapplePorts } from '@wildshard/game/plugin/mover';
import { WELL, Y0 } from '../layout';
import type { GrappleMode } from '@wildshard/format/modes';
import { NINE_GRAPPLE } from '../data/modes';

const RIM_WALL = Y0 + 3.2;
const vDir = new Vector3(), vPast = new Vector3();

/** A hook beyond the Well rail (at z = `rimZ`) is visible to the claw if the rail is the only obstruction (the line of sight is blocked). */
function seePastWellRail(ports: GrapplePorts, rimZ: number, eye: Vector3, hook: Vector3): boolean {
  const body = ports.body.motor.collider;
  const hit = castSegment(ports.physics, eye, hook, ['WORLD'], body);
  if (hit === null || Math.abs(hit.point.z - rimZ) > 0.45 || hit.point.x < WELL.x0 || hit.point.x > WELL.x1) return false;
  // the page tags a collider with its piece, the host with the piece's id (runtime/headless.ts: snapshot-safe owners)
  const owner = hit.owner;
  const id: unknown = typeof owner === 'string' ? owner : typeof owner === 'object' && owner !== null ? Reflect.get(owner, 'id') : null;
  if (id !== 'nds-floors' && id !== 'nds-grapple-guard') return false;
  vDir.subVectors(hook, eye).normalize();
  vPast.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(vDir, 1.1);
  return lineOfSight(ports.physics, vPast, hook, 1.1, body);
}

/**
 * The fragment's own course: its dragon hooks, the Well rail a hook may be seen past, and the crossing north over the
 * Well from the south rim — it lifts over the rim's stone parapet first, with the safety cap open (`guard`). `rimZ` is
 * the south rim's line (world/well-plan.ts `RIM.z0`, which the world's renderer-bound plan module owns).
 */
export function wellCourse(hooks: readonly Vector3[], rimZ: number, guard: (open: boolean) => void, mode: GrappleMode = NINE_GRAPPLE): GrappleCourse {
  return {
    name: 'Nine Dragon Stack', mode,
    hooks,
    seePast: (ports, eye, hook) => seePastWellRail(ports, rimZ, eye, hook),
    lifts: (p, landing) => p.z > rimZ && landing.z < rimZ && p.x >= WELL.x0 && p.x <= WELL.x1 && p.y >= Y0 - 1,
    // lift high enough that the straight pull to the approach point clears the rim's stone parapet (its top + a
    // margin, measured where the capsule has passed the stone), never less than the old 3.5 m, under the cap's top
    liftTo: (p, a) => {
      const past = rimZ - 0.7;
      const t = Math.min(0.9, Math.max(0, (p.z - past) / Math.max(0.01, p.z - a.z)));
      return Math.min(Y0 + 11, Math.max(p.y + 3.5, (RIM_WALL + 0.35 - a.y * t) / (1 - t)));
    },
    guard,
  };
}


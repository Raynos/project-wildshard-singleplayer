import type { MoverData } from '@wildshard/game/shardfile/movers';
import { DWELL, LIFTS, RIDE, cageBoxes, doorBoxes, gateBoxes, liftBottom, liftTop, liftYaw, roadGateAt, roadGateBoxes } from '../world/liftPlan';

/**
 * SF51-p (G184) / SF8c: five rows a lantern lift, all running behaviour/lift.as and all sent the same commands, so they
 * move as one: the cage (carries the rider), its gates (collide only while it moves), the deck's door and the street's
 * door (each collides unless the cage rests at its end, so nobody walks into the empty shaft), and the stationary road
 * gate across the socket's inner line (collides unless the cage rests at the deck). The cage and the road gate are the
 * shardfile's socketLift rows (shard.config.ts); the other three stay the trusted runtime's. Parameters: bottom, top,
 * the ride, the part, the dwell at the top. Build-only capture of world/liftPlan.ts.
 */
export function captureNineDragonMovers(module: string): MoverData {
  const zero = { x: 0, y: 0, z: 0 };
  return LIFTS.flatMap((l, i) => {
    const b = liftBottom(l), t = liftTop(l), g = roadGateAt(l), euler = { x: 0, y: liftYaw(l), z: 0 }, entity = 9001 + i * 5;
    const ride = [b.x, b.y, b.z, t.x, t.y, t.z, RIDE];
    return [
      { id: l.id, entity, module, kind: 'platform', at: b, euler, enabled: true, boxes: cageBoxes(), input: [...ride, 0, DWELL] },
      { id: `${l.id}.gates`, entity: entity + 1, module, kind: 'platform', at: b, euler, enabled: false, boxes: gateBoxes(), input: [...ride, 1, DWELL] },
      { id: `${l.id}.deck-door`, entity: entity + 2, module, kind: 'static', at: b, euler, enabled: false, boxes: doorBoxes('deck'), input: [b.x, b.y, b.z, b.x, b.y, b.z, RIDE, 2, DWELL] },
      { id: `${l.id}.street-door`, entity: entity + 3, module, kind: 'static', at: t, euler, enabled: true, boxes: doorBoxes('street'), input: [t.x, t.y, t.z, t.x, t.y, t.z, RIDE, 3, DWELL] },
      { id: `${l.id}.road-gate`, entity: entity + 4, module, kind: 'static', at: g, euler: zero, enabled: false, boxes: roadGateBoxes(l), input: [g.x, g.y, g.z, g.x, g.y, g.z, RIDE, 2, DWELL] },
    ] satisfies MoverData;
  });
}

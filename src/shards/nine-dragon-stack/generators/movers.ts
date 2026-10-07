import type { MoverData } from '@wildshard/game/shardfile/movers';
import { LIFTS, RIDE, cageBoxes, doorBoxes, gateBoxes, liftBottom, liftTop, liftYaw } from '../world/liftPlan';

/**
 * SF51-p (G184): four rows a lantern lift, all running behaviour/lift.as and all sent the same commands, so they move as
 * one: the cage (carries the rider), its gates (collide only while it moves), the deck's door and the street's door (each
 * collides unless the cage rests at its end, so nobody walks into the empty shaft). Build-only capture of world/liftPlan.ts.
 */
export function captureNineDragonMovers(module: string): MoverData {
  return LIFTS.flatMap((l, i) => {
    const b = liftBottom(l), t = liftTop(l), euler = { x: 0, y: liftYaw(l), z: 0 }, entity = 9001 + i * 4;
    const ride = [b.x, b.y, b.z, t.x, t.y, t.z, RIDE];
    return [
      { id: l.id, entity, module, kind: 'platform', at: b, euler, enabled: true, boxes: cageBoxes(), input: [...ride, 0] },
      { id: `${l.id}.gates`, entity: entity + 1, module, kind: 'platform', at: b, euler, enabled: false, boxes: gateBoxes(), input: [...ride, 1] },
      { id: `${l.id}.deck-door`, entity: entity + 2, module, kind: 'static', at: b, euler, enabled: false, boxes: doorBoxes('deck'), input: [b.x, b.y, b.z, b.x, b.y, b.z, RIDE, 2] },
      { id: `${l.id}.street-door`, entity: entity + 3, module, kind: 'static', at: t, euler, enabled: true, boxes: doorBoxes('street'), input: [t.x, t.y, t.z, t.x, t.y, t.z, RIDE, 3] },
    ] satisfies MoverData;
  });
}

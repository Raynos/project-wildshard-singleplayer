import { Euler, Quaternion, Vector3 } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverData } from '@wildshard/game/shardfile/movers';
import { SPANS, FALLEN_BRIDGE } from '../layout';
import { FALLEN_ANGLE, deckCollider, saggedColliders, railColliders, spanYaw } from '../world/build';
import { isletMoverRows } from '../world/risingIslet';

/** Today's ordinary rope bridges stay static; the raised bridge's local boxes are baked at its hinge; SF49-g's four Rising
 *  Islets (G183) ride `isletModule` (behaviour/islet.as). */
export function captureSkyMovers(module: string, isletModule: string): MoverData {
  const boxes = (descs: readonly ColliderDesc[], at: { x: number; y: number; z: number }, yaw = 0) => descs.map((d) => {
    if (d.kind !== 'box') throw new Error('Bridge primitive changed');
    const inverse = new Quaternion().setFromEuler(new Euler(0, yaw, 0, 'YXZ')).invert(), p = new Vector3(d.x, d.y, d.z).sub(new Vector3(at.x, at.y, at.z)).applyQuaternion(inverse);
    const rot = inverse.multiply(d.rot === undefined ? new Quaternion().setFromEuler(new Euler(0, d.yaw ?? 0, 0)) : new Quaternion(d.rot.x, d.rot.y, d.rot.z, d.rot.w));
    return { x: p.x, y: p.y, z: p.z, hx: d.hx, hy: d.hy, hz: d.hz, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
  });
  const zero = { x: 0, y: 0, z: 0 }, spans: MoverData = SPANS.filter((s) => s.kind === 'rope').map((span, i) => ({ id: span.id, entity: 8001 + i, module, kind: 'static', at: zero, euler: zero, enabled: true, boxes: boxes(saggedColliders(span), zero), input: [0] }));
  const at = { x: FALLEN_BRIDGE.x0, y: FALLEN_BRIDGE.y, z: FALLEN_BRIDGE.z0 }, yaw = spanYaw(FALLEN_BRIDGE);
  return [...spans, { id: 'far.winch.bridge', entity: 8010, module, kind: 'platform', at, euler: { x: FALLEN_ANGLE, y: yaw, z: 0 }, enabled: false, boxes: boxes([deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], at, yaw), input: [1, 0.55] }, ...isletMoverRows(isletModule)];
}

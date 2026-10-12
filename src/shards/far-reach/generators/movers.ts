import { AnimationClip, Euler, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverData } from '@wildshard/format/movers';
import { Mover } from '@wildshard/sdk/movers';
import { SPANS, FALLEN_BRIDGE } from '../data/layout';
import { FALLEN_ANGLE, spanYaw } from '../world/build';
import { deckCollider, saggedColliders, railColliders } from './bridgeColliders';
import { ISLET_ISLE, isletId, gateId } from '../world/risingIslet';
import { apothem } from '../layout';
import type { MoverBox } from '@wildshard/engine/physics/mover';
import { RISING_ISLETS } from '../world/islets';
import { ISLET } from '../data/isletDesign';

// Three's configurable buffer types preserve authored f64 stops instead of rounding native gameplay to Float32.
class PositionStops extends VectorKeyframeTrack {}
PositionStops.prototype.TimeBufferType = Float64Array; PositionStops.prototype.ValueBufferType = Float64Array;
class RotationStops extends QuaternionKeyframeTrack {}
RotationStops.prototype.TimeBufferType = Float64Array; RotationStops.prototype.ValueBufferType = Float64Array;
const zero = { x: 0, y: 0, z: 0 };
/** The islet's deck: six strips 30° apart over its 12-gon (world/build.ts islandColliders), as local mover boxes. */
export function isletBoxes(): MoverBox[] {
  const half = apothem(ISLET_ISLE), width = ISLET_ISLE.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 6, q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a);
    return { x: 0, y: -1, z: 0, hx: half, hy: 1, hz: width, rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
  });
}
function body(id: string): Group { const object = new Group(); object.name = id; return object; }
function ride(id: string, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, travel: number, gate: boolean): Mover {
  const object = body(id), keys = new PositionStops(`${id}.position`, [0, travel], [from.x, from.y, from.z, to.x, to.y, to.z]);
  object.position.set(from.x, from.y, from.z);
  return new Mover(object, { clip: new AnimationClip('ride', travel, [keys]), trigger: { kind: 'interact', permission: 0 }, driver: { kind: 'winch', mode: 'ride', dwell: ISLET.dwell, gate } });
}
/** Author the native bridges and socket lifts with real clips; the fixed row compiler preserves the shipping guest ABI. */
export function captureSkyMovers(module: string, isletModule: string): MoverData {
  const boxes = (descs: readonly ColliderDesc[], at: { x: number; y: number; z: number }, yaw = 0) => descs.map((d) => {
    if (d.kind !== 'box') throw new Error('Bridge primitive changed');
    const inverse = new Quaternion().setFromEuler(new Euler(0, yaw, 0, 'YXZ')).invert(), p = new Vector3(d.x, d.y, d.z).sub(new Vector3(at.x, at.y, at.z)).applyQuaternion(inverse);
    const rot = inverse.multiply(d.rot === undefined ? new Quaternion().setFromEuler(new Euler(0, d.yaw ?? 0, 0)) : new Quaternion(d.rot.x, d.rot.y, d.rot.z, d.rot.w));
    return { x: p.x, y: p.y, z: p.z, hx: d.hx, hy: d.hy, hz: d.hz, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
  });
  const spans = SPANS.filter((s) => s.kind === 'rope').map((span, i) => new Mover(body(span.id), { trigger: { kind: 'always' }, driver: { kind: 'static' } }).toMoverData({ id: span.id, entity: 8001 + i, kind: 'static', at: zero, euler: zero, enabled: true, boxes: boxes(saggedColliders(span), zero) }));
  const at = { x: FALLEN_BRIDGE.x0, y: FALLEN_BRIDGE.y, z: FALLEN_BRIDGE.z0 }, yaw = spanYaw(FALLEN_BRIDGE), id = 'far.winch.bridge', speed = 0.55, duration = -FALLEN_ANGLE / speed;
  const object = body(id); object.rotation.set(FALLEN_ANGLE, yaw, 0, 'YXZ');
  // The hinge's local pitch animation is independent of its fixed world yaw.
  const turn = new RotationStops(`${id}.quaternion`, [0, duration], [Math.sin(FALLEN_ANGLE / 2), 0, 0, Math.cos(FALLEN_ANGLE / 2), 0, 0, 0, 1]);
  const winch = new Mover(object, { clip: new AnimationClip('raise', duration, [turn]), trigger: { kind: 'interact', permission: 3 }, driver: { kind: 'winch', mode: 'hinge', speed } }).toMoverData({ id, entity: 8010, kind: 'platform', at, euler: { x: FALLEN_ANGLE, y: yaw, z: 0 }, enabled: false, boxes: boxes([deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], at, yaw) });
  const islets = RISING_ISLETS.map((entry, i) => ride(isletId(entry), entry.rest, entry.dock, entry.travel, false).toMoverData({ id: isletId(entry), entity: 8020 + i, kind: 'platform', at: { ...entry.rest }, euler: zero, enabled: true, boxes: isletBoxes() }));
  const gates = RISING_ISLETS.map((entry, i) => {
    const g = entry.gateBar, gateAt = { x: g.x, y: g.y, z: g.z }, gate = gateId(entry);
    return ride(gate, gateAt, gateAt, entry.travel, true).toMoverData({ id: gate, entity: 8030 + i, kind: 'static', at: gateAt, euler: zero, enabled: false, boxes: [{ x: 0, y: 0, z: 0, hx: g.hx, hy: g.hy, hz: g.hz, rot: { x: 0, y: 0, z: 0, w: 1 } }] });
  });
  const rows = [...spans, winch, ...islets, ...gates];
  if (rows.some(row => row.module !== (row.id.startsWith('far.islet.') ? isletModule : module))) throw new Error('Compiled fixed driver hash changed');
  return rows;
}

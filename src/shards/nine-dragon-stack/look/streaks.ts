import { AddEquation, CustomBlending, Float32BufferAttribute, Mesh, OneFactor, Vector3, Vector4, ZeroFactor } from 'three';
import { type Emitter, emitterCardsGeometry } from '../runtime/looks/emitterCards';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import type { StairCardPlan } from '../runtime/looks/reflectionCards';
import type { Shared } from './style';

/** Shared performance knobs; the graph reads these before every frame. */
export const STREAK_PERF = new Vector4(2.5, 0.3, 0, 0);

/** Receiver constants are geometry channels, so all planes share one compiled graph. */
function cards(emitters: readonly Emitter[], hole: Vector4, origin: Vector3, u: Vector3, n: Vector3, clip = new Vector4(-1e5, -1e5, 1e5, 1e5), stair = false, lift = 0): Mesh {
  const geometry = emitterCardsGeometry(emitters);
  const attributes = { aPlaneO: origin.toArray(), aPlaneU: u.normalize().toArray(), aPlaneN: n.normalize().toArray(), aClip: clip.toArray(), aHole: hole.toArray(),
    aSpread: [0.9, 0.95, stair ? 0.12 : 0.3, 0.6], aCardK: [1.15 * (stair ? 1.3 : 1), stair ? 0.8 : 0.6, 0.45, 1], aLift: [lift] };
  for (const [name, value] of Object.entries(attributes)) geometry.setAttribute(name, new Float32BufferAttribute(Array.from({ length: 4 }, () => value).flat(), value.length));
  const material = lentLook('nine-streaks');
  material.blending = CustomBlending; material.blendEquation = AddEquation; material.blendSrc = OneFactor; material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor; material.blendDstAlpha = OneFactor;
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 4;
  return mesh;
}

/** Square and street share their floor; the Well's open shaft never reflects. */
export function buildStreaks(shared: Shared, emitters: readonly Emitter[], hole: Vector4): Mesh {
  return cards(emitters, hole, new Vector3(0, shared.u.uGroundY.value, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0));
}

/** One sloped receiver under each flight's nosings, one flat receiver per landing. */
export function stairStreaks(_shared: Shared, emitters: readonly Emitter[], plan: StairCardPlan): Mesh[] {
  const slope = plan.rise / plan.run, hole = new Vector4();
  return [...plan.flights.map(f => cards(emitters, hole, new Vector3(f.x0, f.y0 + plan.rise * 0.5, 0), new Vector3(1, slope, 0), new Vector3(-slope, 1, 0), new Vector4(f.x0, plan.z0, f.x1, plan.z1), true, plan.rise * 0.42)),
    ...plan.landings.map(l => cards(emitters, hole, new Vector3(0, l.y, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector4(l.x0, plan.z0, l.x1, plan.z1), true))];
}

/** Existing post controls keep their graph parameter. */
export function setStreakOn(value: number): void { setLentParam('nine-streaks', 'cardOn', value); }

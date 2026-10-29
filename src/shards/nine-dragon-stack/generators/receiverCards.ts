import { AddEquation, CustomBlending, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Uint16BufferAttribute, MeshBasicMaterial, type Color, Mesh, OneFactor, Vector3, Vector4, ZeroFactor } from 'three';

export interface Emitter { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
export interface StairCardPlan { readonly flights: readonly { readonly x0: number; readonly x1: number; readonly y0: number }[]; readonly landings: readonly { readonly x0: number; readonly x1: number; readonly y: number }[]; readonly rise: number; readonly run: number; readonly z0: number; readonly z1: number }
/** One receiver plane and the emitters it reflects (its constants ride each emitter's card instance). */
export interface Receiver {
  readonly emitters: readonly Emitter[]; readonly hole: Vector4; readonly origin: Vector3; readonly u: Vector3; readonly n: Vector3;
  readonly clip: Vector4; readonly stair: boolean; readonly lift: number;
}

/**
 * Every receiver in one draw (FC12, G913: the floor and each stair flight and landing were a draw each): a card instance
 * per receiver and emitter, the receiver's plane constants instance channels beside the emitter's, so all planes share
 * one compiled graph and one buffer.
 */
export function receiverCards(receivers: readonly Receiver[]): Mesh {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('aCorner', new Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  const channels: Record<string, { size: number; values: number[] }> = {};
  const put = (name: string, value: readonly number[]): void => { const row = channels[name] ??= { size: value.length, values: [] }; row.values.push(...value); };
  let count = 0;
  for (const r of receivers) {
    const plane = { aPlaneO: r.origin.toArray(), aPlaneU: r.u.clone().normalize().toArray(), aPlaneN: r.n.clone().normalize().toArray(), aClip: r.clip.toArray(), aHole: r.hole.toArray(),
      aSpread: [0.9, 0.95, r.stair ? 0.12 : 0.3, 0.6], aCardK: [1.15 * (r.stair ? 1.3 : 1), r.stair ? 0.8 : 0.6, 0.45, 1], aLift: [r.lift] };
    for (const e of r.emitters) {
      put('aE', e.at.toArray()); put('aCol', e.color.toArray()); put('aSize', [e.w, e.h, e.power]);
      for (const [name, value] of Object.entries(plane)) put(name, value);
      count++;
    }
  }
  for (const [name, row] of Object.entries(channels)) geometry.setAttribute(name, new InstancedBufferAttribute(Float32Array.from(row.values), row.size));
  geometry.instanceCount = count;
  const material = new MeshBasicMaterial();
  material.blending = CustomBlending; material.blendEquation = AddEquation; material.blendSrc = OneFactor; material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor; material.blendDstAlpha = OneFactor;
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 4;
  return mesh;
}

/** Square and street share their floor; the Well's open shaft never reflects. */
export function floorReceiver(ground: number, emitters: readonly Emitter[], hole: Vector4): Receiver {
  return { emitters, hole, origin: new Vector3(0, ground, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: new Vector4(-1e5, -1e5, 1e5, 1e5), stair: false, lift: 0 };
}

/** One sloped receiver under each flight's nosings, one flat receiver per landing. */
export function stairReceivers(emitters: readonly Emitter[], plan: StairCardPlan): Receiver[] {
  const slope = plan.rise / plan.run, hole = new Vector4();
  return [...plan.flights.map(f => ({ emitters, hole, origin: new Vector3(f.x0, f.y0 + plan.rise * 0.5, 0), u: new Vector3(1, slope, 0), n: new Vector3(-slope, 1, 0),
    clip: new Vector4(f.x0, plan.z0, f.x1, plan.z1), stair: true, lift: plan.rise * 0.42 })),
  ...plan.landings.map(l => ({ emitters, hole, origin: new Vector3(0, l.y, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: new Vector4(l.x0, plan.z0, l.x1, plan.z1), stair: true, lift: 0 }))];
}

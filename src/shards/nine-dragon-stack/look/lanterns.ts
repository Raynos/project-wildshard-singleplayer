// Lanterns share the world's existing instance packer, including distance LODs.
import { Color, InstancedBufferAttribute, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { HandedBatch, InstancedCuller } from '@wildshard/engine/models/place';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import { InstanceCuller } from '../runtime/cull/instanceCuller';
import type { Emitter } from '../runtime/looks/emitterCards';

export const LOD_NEAR = 35;
export const LOD_DOT = 80;
const live: Lanterns[] = [];
export function updateLanterns(camera: PerspectiveCamera): void { for (const set of live) set.update(camera); }
export function clearLanterns(): void { live.length = 0; }
export function lanternAudioPositions(): Vector3[] { return live.flatMap(set => set.emitters.map(e => e.at.clone())); }

/** Keep placement and emitter handles; the shared instance packer owns culling. */
export class Lanterns implements InstancedCuller {
  readonly emitters: Emitter[] = [];
  readonly material = lentLook('nine-lantern');
  private readonly mats: Matrix4[] = [];
  private readonly culler = new InstanceCuller();
  constructor(private readonly row: { readonly drop: number; readonly glow: { readonly color: number; readonly w: number; readonly h: number; readonly power: number; readonly spill: number } }) {}
  hang(top: Vector3, scale = 1): void {
    const at = top.clone().add(new Vector3(0, -this.row.drop * scale, 0)), g = this.row.glow;
    this.mats.push(new Matrix4().compose(at, new Quaternion(), new Vector3(scale, scale, scale)));
    this.emitters.push({ at, color: new Color(g.color), w: g.w * scale, h: g.h * scale, power: g.power, spill: g.spill * scale });
  }
  placements(): Placement<object>[] { return this.mats.map(matrix => ({ x: matrix.elements[12], y: matrix.elements[13], z: matrix.elements[14], matrix })); }
  take(batch: HandedBatch): void {
    const near = batch.levels[0]?.mesh;
    if (near === null || near === undefined) throw new Error('Missing lantern near draw');
    near.geometry.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from(this.mats, (_, i) => ((i + 1) * 0.618) % 1), 1));
    near.name = 'lanterns-near';
    this.culler.add(near, Number.POSITIVE_INFINITY, batch.levels.slice(1).flatMap(level => level.mesh === null ? [] : [{ mesh: level.mesh, from: level.from }]));
    const far = batch.levels[1]?.mesh, dot = batch.levels[2]?.mesh;
    if (far !== null && far !== undefined) far.name = 'lanterns-far';
    if (dot !== null && dot !== undefined) dot.name = 'lanterns-dot';
    live.push(this);
  }
  update(camera: PerspectiveCamera): void { this.culler.update(camera); }
}

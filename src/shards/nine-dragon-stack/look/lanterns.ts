// Lanterns share the world's existing instance packer, including distance LODs.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { Emitter } from '../runtime/looks/emitterCards';

const live: Lanterns[] = [];
export function clearLanterns(): void { live.length = 0; }
export function lanternAudioPositions(): Vector3[] { return live.flatMap(set => set.emitters.map(e => e.at.clone())); }

/** Keep placement and emitter handles; the shared instance packer owns culling. */
export class Lanterns {
  readonly emitters: Emitter[] = [];
  private readonly mats: Matrix4[] = [];
  constructor(private readonly row: { readonly drop: number; readonly glow: { readonly color: number; readonly w: number; readonly h: number; readonly power: number; readonly spill: number } }) { live.push(this); }
  hang(top: Vector3, scale = 1): void {
    const at = top.clone().add(new Vector3(0, -this.row.drop * scale, 0)), g = this.row.glow;
    this.mats.push(new Matrix4().compose(at, new Quaternion(), new Vector3(scale, scale, scale)));
    this.emitters.push({ at, color: new Color(g.color), w: g.w * scale, h: g.h * scale, power: g.power, spill: g.spill * scale });
  }
  placements(): Placement<Record<string, unknown>>[] { return this.mats.map(matrix => ({ x: matrix.elements[12], y: matrix.elements[13], z: matrix.elements[14], matrix })); }
}

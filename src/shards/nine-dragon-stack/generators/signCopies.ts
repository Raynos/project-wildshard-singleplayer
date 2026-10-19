import { Box3, Vector3 } from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { SignModelParams, SignModelRow } from '../data/signTypes';

export interface PlacedSign<S extends string = string> {
  readonly p: { readonly at: Vector3; readonly normal: Vector3; readonly size: number;
    readonly spec: Pick<SignModelParams<S>, 'text' | 'color' | 'vertical' | 'style' | 'ink'>;
    readonly gain?: number; readonly flicker?: number; readonly blade?: boolean; readonly board?: number; readonly fogK?: number; readonly clear?: number };
  readonly w: number; readonly h: number; readonly neon: boolean;
}


const _up = new Vector3(), _r = new Vector3(), _c = new Vector3(), _b = new Box3();

/** a placed sign's copy: centred on its face, turned to face its normal; its world box (the face, the board's depth) */
function copyOf<S extends string>(s: PlacedSign<S>, boxes: Float32Array, i: number, row: SignModelRow): Placement<SignModelParams<S>> {
  const { p, w, h } = s;
  const side = row.sideways.includes(p.spec.style);
  _up.set(side ? 1 : 0, side ? 0 : 1, 0);
  const facing = s.neon ? p.normal.clone().setY(0).normalize() : p.normal;
  _r.crossVectors(_up, facing).normalize();
  const depth = s.neon ? row.neonDepth : p.blade === true ? row.bladeDepth : row.depth;
  _b.makeEmpty();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    _b.expandByPoint(_c.copy(p.at).addScaledVector(_r, (sx * w) / 2).addScaledVector(_up, (sy * h) / 2).addScaledVector(facing, (sz * depth) / 2 + (s.neon ? 0 : row.standoff)));
  }
  boxes.set([_b.min.x, _b.min.y, _b.min.z, _b.max.x, _b.max.y, _b.max.z], i * 6);
  const params: SignModelParams<S> = {
    style: p.spec.style, text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, size: p.size, blade: p.blade === true,
    ...(p.spec.ink === undefined ? {} : { ink: p.spec.ink }), ...(p.board === undefined ? {} : { board: p.board }), ...(p.gain === undefined ? {} : { gain: p.gain }),
  };
  return { x: p.at.x, y: p.at.y, z: p.at.z, yaw: Math.atan2(facing.x, facing.z), variant: row.variantOf[p.spec.style] ?? p.spec.style, params };
}

export function signCopies(placed: readonly PlacedSign[], row: SignModelRow): { neon: boolean; boxes: number[]; poses: Placement<SignModelParams>[] }[] {
  return [false, true].map(neon => {
    const list = placed.filter(sign => sign.neon === neon), boxes = new Float32Array(list.length * 6);
    return { neon, poses: list.map((sign, i) => copyOf(sign, boxes, i, row)), boxes: Array.from(boxes) };
  });
}

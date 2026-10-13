import { Matrix4, Quaternion, Vector3 } from 'three';
import { CROWN } from '../data/layout';
import { CARVED } from '../data/modelFrames';
import { CROWN_STONES } from '../data/crownLayout';

/** The alternating stone models, in their original float32 instance-buffer order. */
export function crownInstances(): number[][] {
  const matrix = new Matrix4(), rotation = new Quaternion(), up = new Vector3(0, 1, 0);
  return [0, 1].map(model => CROWN_STONES.filter((_, index) => index % 2 === model).flatMap(stone => {
    rotation.setFromAxisAngle(up, stone.yaw + CARVED.yaw);
    matrix.compose(new Vector3(stone.x, CROWN.y - CARVED.sink, stone.z), rotation, new Vector3(stone.h, stone.h, stone.h));
    return matrix.elements.map(Math.fround);
  }));
}

/** Static scatter matrices and collision descriptors, authored in the native registration order. */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { placeCollider, poseOf } from '@wildshard/engine/models/colliders';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { PropPose, PropRows } from './propRows';
import type { PinePropShapes } from './propShapes';

/** Preserve pose doubles for native contacts and the original Float32 upload for draws. */
function frame([x, y, z, qx, qy, qz, qw, scale]: PropPose): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion(qx, qy, qz, qw), new Vector3(scale, scale, scale));
}
export interface PropSceneRows {
  readonly groups: readonly {
    readonly id: string; readonly geometry: string; readonly material: string;
    readonly matrices: readonly number[]; readonly sphere: readonly number[];
    readonly castShadow: true; readonly receiveShadow: true;
  }[];
  readonly registry: readonly { readonly id: string; readonly name: string; readonly surface: 'rock' | 'wood'; readonly colliders: readonly ColliderDesc[] }[];
}

/** The retained model reader's hull/capsule placement, executed once by the generator. */
export function bakePropSceneRows(rows: PropRows, shapes: PinePropShapes['rows']): PropSceneRows {
  const groups: PropSceneRows['groups'][number][] = [];
  const rocks: ColliderDesc[] = [], stumps: ColliderDesc[] = [], logs: ColliderDesc[] = [];
  const rockFrames: Matrix4[][] = shapes.rocks.map(() => []);
  for (const [kind, solid, ...pose] of rows.rocks) {
    const shape = shapes.rocks[kind], matrix = frame(pose);
    if (shape === undefined) throw new Error('Unknown authored boulder shape');
    rockFrames[kind]?.push(matrix);
    if (solid === 1) rocks.push(placeCollider({ kind: 'hull', x: 0, y: 0, z: 0, points: Float32Array.from(shape.hull) }, poseOf({ x: pose[0], y: pose[1], z: pose[2], matrix })));
  }
  const add = (id: string, shape: { readonly name: string; readonly sphere: readonly number[] }, material: string, matrices: readonly Matrix4[]): void => {
    if (matrices.length === 0) return;
    groups.push({ id, geometry: shape.name, material, matrices: [...Float32Array.from(matrices.flatMap(matrix => matrix.elements))], sphere: shape.sphere, castShadow: true, receiveShadow: true });
  };
  for (const [i, shape] of shapes.rocks.entries()) add(`rock-${i}`, shape, 'props.rocks', rockFrames[i] ?? []);
  const stumpFrames = rows.stumps.map(frame), logFrames = rows.logs.map(frame);
  for (const [i, shape] of shapes.stumps.entries()) add(`stump-${i}`, shape, `props.stumps.${i}`, stumpFrames);
  for (const [i, shape] of shapes.log.parts.entries()) add(`log-${i}`, shape, `props.log.${i}`, logFrames);
  for (const [i, pose] of rows.stumps.entries()) {
    const matrix = stumpFrames[i]; if (matrix === undefined) throw new Error('Missing authored stump frame');
    const placed = poseOf({ x: pose[0], y: pose[1], z: pose[2], matrix });
    for (const shape of shapes.stumps) stumps.push(placeCollider({ kind: 'hull', x: 0, y: 0, z: 0, points: Float32Array.from(shape.hull) }, placed));
  }
  for (const [i, pose] of rows.logs.entries()) {
    const matrix = logFrames[i]; if (matrix === undefined) throw new Error('Missing authored log frame');
    logs.push(placeCollider(shapes.log.capsule, poseOf({ x: pose[0], y: pose[1], z: pose[2], matrix })));
  }
  return { groups, registry: [
    { id: 'props', name: 'Mossy boulder', surface: 'rock', colliders: rocks },
    { id: 'props-stumps', name: 'Tree stump', surface: 'wood', colliders: stumps },
    { id: 'props-wood', name: 'Fallen log', surface: 'wood', colliders: logs },
  ] };
}

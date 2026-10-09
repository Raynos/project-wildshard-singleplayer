import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

/** Ordered collision joints only: parent precedes child, -1 attaches to the supplied world frame. */
export interface CollisionJoint {
  readonly parent: number;
  readonly position: readonly [number, number, number];
}

/** Collision-only FK. It never constructs a scene node, skeleton, vertex buffer or skinned mesh. */
export class CollisionPose {
  private readonly local: Matrix4[];
  private readonly world: Matrix4[];
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private readonly quaternion = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly centre = new Vector3();
  private readonly axis = new Vector3();
  private readonly up = new Vector3();

  constructor(private readonly joints: readonly CollisionJoint[]) {
    if (joints.length === 0 || joints.length > 32 || joints.some((joint, i) =>
      !Number.isInteger(joint.parent) || joint.parent < -1 || joint.parent >= i
      || !joint.position.every(Number.isFinite))) {
      throw new RangeError('Invalid collision joint chain');
    }
    this.local = joints.map(joint => new Matrix4().makeTranslation(...joint.position));
    this.world = joints.map(() => new Matrix4());
  }

  /** Offset from the baked rest translation, with the same YXZ angle convention as the visual rig. */
  set(index: number, offset: readonly [number, number, number], angles: readonly [number, number, number]): void {
    const joint = this.joints[index], matrix = this.local[index];
    if (joint === undefined || matrix === undefined || !offset.every(Number.isFinite)
      || !angles.every(Number.isFinite)) throw new RangeError('Invalid collision joint pose');
    this.position.set(joint.position[0] + offset[0], joint.position[1] + offset[1], joint.position[2] + offset[2]);
    this.quaternion.setFromEuler(this.rotation.set(...angles, 'YXZ'));
    matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Resolve once after posing; the caller supplies its existing world frame, including terrain tilt and scale. */
  solve(frame: Matrix4): void {
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i], local = this.local[i], world = this.world[i];
      if (joint === undefined || local === undefined || world === undefined) throw new Error('Missing collision joint');
      const parent = joint.parent === -1 ? frame : this.world[joint.parent];
      if (parent === undefined) throw new Error('Missing collision parent');
      world.multiplyMatrices(parent, local);
    }
  }

  /** A collision anchor in joint-local units, resolved into the supplied frame. */
  point(index: number, at: readonly [number, number, number], out: Vector3): Vector3 {
    return out.set(...at).applyMatrix4(this.matrix(index));
  }

  /** The shipping capsule construction: the joint's scaled x/z axis, pitched toward its y axis. */
  capsule(index: number, at: readonly [number, number, number], axis: 'x' | 'z', pitch: number, halfLength: number,
    rear: Vector3, front: Vector3): void {
    const matrix = this.matrix(index), elements = matrix.elements;
    this.centre.set(...at).applyMatrix4(matrix);
    if (axis === 'x') this.axis.set(elements[0], elements[1], elements[2]);
    else this.axis.set(elements[8], elements[9], elements[10]);
    this.axis.multiplyScalar(Math.cos(pitch)).addScaledVector(this.up.set(elements[4], elements[5], elements[6]), Math.sin(pitch));
    rear.copy(this.centre).addScaledVector(this.axis, -halfLength);
    front.copy(this.centre).addScaledVector(this.axis, halfLength);
  }

  private matrix(index: number): Matrix4 {
    const matrix = this.world[index];
    if (matrix === undefined) throw new RangeError('Missing collision joint');
    return matrix;
  }
}

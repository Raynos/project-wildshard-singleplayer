import { Euler, Matrix4, Quaternion, Vector3, type EulerOrder } from 'three';

const UNIT_SCALE = [1, 1, 1] as const;
const ORDERS = new Set<EulerOrder>(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']);

/** Ordered collision joints only: parent precedes child, -1 attaches to the supplied world frame. */
export interface CollisionJoint {
  readonly parent: number;
  readonly position: readonly [number, number, number];
  /** Defaults to YXZ, preserving existing collision recipes. */
  readonly order?: EulerOrder;
  /** The rest joint scale, unit scale when omitted. */
  readonly scale?: readonly [number, number, number];
}

/** Absolute local transform from a trusted numeric rig; Euler order can change when the pose sets it. */
export interface CollisionTransform {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotation: Readonly<{ x: number; y: number; z: number; order: EulerOrder }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
}
const finiteVector = (value: Readonly<{ x: number; y: number; z: number }>): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

/** Collision-only FK. It never constructs a scene node, skeleton, vertex buffer or skinned mesh. */
export class CollisionPose {
  private readonly joints: readonly CollisionJoint[];
  private readonly local: Matrix4[];
  private readonly world: Matrix4[];
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private readonly quaternion = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly centre = new Vector3();
  private readonly axis = new Vector3();
  private readonly up = new Vector3();

  constructor(joints: readonly CollisionJoint[]) {
    if (joints.length === 0 || joints.length > 32 || joints.some((joint, i) =>
      !Number.isInteger(joint.parent) || joint.parent < -1 || joint.parent >= i
      || !joint.position.every(Number.isFinite) || (joint.order !== undefined && !ORDERS.has(joint.order))
      || (joint.scale !== undefined && !joint.scale.every(Number.isFinite)))) {
      throw new RangeError('Invalid collision joint chain');
    }
    this.joints = joints;
    this.local = joints.map(joint => {
      const matrix = new Matrix4().makeTranslation(...joint.position);
      return joint.scale === undefined ? matrix : matrix.scale(this.scale.set(...joint.scale));
    });
    this.world = joints.map(() => new Matrix4());
  }

  /** Offset from the baked rest translation; omitted order/scale preserve the shipping YXZ/unit recipe. */
  set(index: number, offset: readonly [number, number, number], angles: readonly [number, number, number], scale?: readonly [number, number, number]): void {
    const joint = this.joints[index], matrix = this.local[index];
    if (joint === undefined || matrix === undefined || !offset.every(Number.isFinite)
      || !angles.every(Number.isFinite) || (scale !== undefined && !scale.every(Number.isFinite))) throw new RangeError('Invalid collision joint pose');
    this.position.set(joint.position[0] + offset[0], joint.position[1] + offset[1], joint.position[2] + offset[2]);
    this.quaternion.setFromEuler(this.rotation.set(...angles, joint.order ?? 'YXZ'));
    this.scale.set(...(scale ?? joint.scale ?? UNIT_SCALE));
    matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Apply an absolute local transform without subtracting/re-adding its rest translation. Does not publish worlds. */
  setLocal(index: number, transform: CollisionTransform): void {
    const matrix = this.local[index], { position, rotation, scale } = transform;
    if (matrix === undefined || !finiteVector(position) || !finiteVector(rotation) || !finiteVector(scale)
      || !ORDERS.has(rotation.order)) throw new RangeError('Invalid collision joint pose');
    this.position.set(position.x, position.y, position.z);
    this.quaternion.setFromEuler(this.rotation.set(rotation.x, rotation.y, rotation.z, rotation.order));
    this.scale.set(scale.x, scale.y, scale.z);
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

  /** Shipping scaled x/z capsules pitch toward y. Upright y capsules follow y directly, as the view does. */
  capsule(index: number, at: readonly [number, number, number], axis: 'x' | 'y' | 'z', pitch: number, halfLength: number,
    rear: Vector3, front: Vector3): void {
    const matrix = this.matrix(index), elements = matrix.elements;
    this.centre.set(...at).applyMatrix4(matrix);
    if (axis === 'x') this.axis.set(elements[0], elements[1], elements[2]);
    else if (axis === 'y') this.axis.set(elements[4], elements[5], elements[6]);
    else this.axis.set(elements[8], elements[9], elements[10]);
    if (axis !== 'y') this.axis.multiplyScalar(Math.cos(pitch)).addScaledVector(this.up.set(elements[4], elements[5], elements[6]), Math.sin(pitch));
    rear.copy(this.centre).addScaledVector(this.axis, -halfLength);
    front.copy(this.centre).addScaledVector(this.axis, halfLength);
  }

  private matrix(index: number): Matrix4 {
    const matrix = this.world[index];
    if (matrix === undefined) throw new RangeError('Missing collision joint');
    return matrix;
  }
}

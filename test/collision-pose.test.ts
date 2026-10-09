import { describe, expect, it } from 'vitest';
import { Bone, Group, Matrix4, Vector3 } from 'three';
import { CollisionPose } from '../src/game/combat/collisionPose';

describe('collision-only joint FK', () => {
  it('equals live joint anchors across scale, tilt and all rotations', () => {
    const joints = [
      { parent: -1, position: [0, 1.5, -0.1] },
      { parent: 0, position: [0, 0.5, 0.6] },
      { parent: 1, position: [0, 0.3, 0.3] },
      { parent: 2, position: [0, 0.25, 0.2] },
    ] as const;
    const collision = new CollisionPose(joints), frame = new Group();
    const bones = joints.map(joint => { const bone = new Bone(); bone.position.set(joint.position[0], joint.position[1], joint.position[2]); return bone; });
    joints.forEach((joint, i) => {
      const parent = joint.parent === -1 ? frame : bones[joint.parent], bone = bones[i];
      if (parent === undefined || bone === undefined) throw new Error('Missing fixture joint');
      parent.add(bone);
    });
    const got = new Vector3(), expected = new Vector3(), a = new Vector3(), b = new Vector3();
    for (let tick = 0; tick < 600; tick++) {
      const t = tick / 60;
      frame.position.set(150 + t, 4, -30); frame.scale.setScalar(2.6);
      frame.rotation.set(0.1 * Math.sin(t), t, -0.08 * Math.cos(t), 'YXZ');
      bones.forEach((bone, i) => {
        const offset = [0, i === 0 ? Math.sin(t) * 0.1 : 0, 0] as const;
        const angles = [Math.sin(t + i) * 0.7, Math.cos(t + i) * 0.3, Math.sin(t * 2 + i) * 0.1] as const;
        collision.set(i, offset, angles);
        bone.position.set(joints[i]?.position[0] ?? 0, (joints[i]?.position[1] ?? 0) + offset[1], joints[i]?.position[2] ?? 0);
        bone.rotation.set(...angles, 'YXZ');
      });
      frame.updateMatrixWorld(true); collision.solve(frame.matrixWorld);
      bones.forEach((bone, i) => {
        collision.point(i, [0, -0.06, 0.12], got);
        expected.set(0, -0.06, 0.12).applyMatrix4(bone.matrixWorld);
        expect(got.distanceTo(expected)).toBeLessThanOrEqual(1e-12);
      });
      collision.capsule(0, [0, -0.3, -0.32], 'z', 0.38, 0.45, a, b);
      const root = bones[0]; if (root === undefined) throw new Error('Missing root');
      expected.set(0, -0.3, -0.32).applyMatrix4(root.matrixWorld);
      expect(a.clone().add(b).multiplyScalar(0.5).distanceTo(expected)).toBeLessThan(1e-12);
      expect(a.distanceTo(b)).toBeCloseTo(0.9 * 2.6, 12);
    }
  });

  it('refuses invalid/cyclic parents and malformed scalar poses', () => {
    expect(() => new CollisionPose([])).toThrow('Invalid collision joint chain');
    expect(() => new CollisionPose([{ parent: 0, position: [0, 0, 0] }])).toThrow('Invalid collision joint chain');
    expect(() => new CollisionPose([{ parent: -2, position: [0, 0, 0] }])).toThrow('Invalid collision joint chain');
    const pose = new CollisionPose([{ parent: -1, position: [0, 0, 0] }]);
    expect(() => pose.set(1, [0, 0, 0], [0, 0, 0])).toThrow('Invalid collision joint pose');
    expect(() => pose.set(0, [0, Number.NaN, 0], [0, 0, 0])).toThrow('Invalid collision joint pose');
    pose.solve(new Matrix4());
    expect(() => pose.point(1, [0, 0, 0], new Vector3())).toThrow('Missing collision joint');
  });
});

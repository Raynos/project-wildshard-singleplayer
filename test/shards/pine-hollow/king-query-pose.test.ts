// oxlint-disable-next-line import/no-nodejs-modules -- The oracle opens the committed King GLB through the trusted bake reader.
import { resolve } from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { readKingRig } from '../../../src/shards/pine-hollow/generators/bake-pine-king-collision.mjs';
import { advanceKingPose, applyKingPose, newPose, type KingPoseInput } from '../../../src/shards/pine-hollow/combat/kingRig';
import { readKingCollisionBake } from '../../../src/shards/pine-hollow/runtime/kingCollisionBake';
import { KingQueryPose } from '../../../src/shards/pine-hollow/runtime/kingQueryPose';
import raw from '../../../src/shards/pine-hollow/runtime/kingCollision.baked.json';

const root = resolve(import.meta.dirname, '../../..');
const EPSILON = 1e-10; // Metres: retain the same floating-point FK bound as the real King volume oracle.

describe('King collision query publication clocks', () => {
  it('matches cached live bones before render, partial rib/head propagation and restored suffixes', () => {
    const bake = readKingCollisionBake(raw), { group, bones, rest } = readKingRig(root);
    const body = bones['body'], chest = bones['chest'], head = bones['head'];
    if (body === undefined || chest === undefined || head === undefined) throw new Error('Missing real King joints');
    const clock = new KingQueryPose(bake.joints, bake.volumes), restored = new KingQueryPose(bake.joints, bake.volumes);
    const pose = newPose(), got = new Vector3(), expected = new Vector3();
    const rear = new Vector3(), front = new Vector3(), centre = new Vector3(), axis = new Vector3(), up = new Vector3();
    const input: KingPoseInput = { dt: 1 / 60, t: 0, scale: 2.6, speed: 0, deathT: -1,
      flinch: 0, brace: 0, attack: -1, lookWeight: 0, yaw: 0, mem: {}, position: group.position,
      lookTarget: { x: 152, y: 3, z: -29 } };
    const check = (): void => {
      clock.head(got); expected.set(...bake.volumes.head).applyMatrix4(head.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
      clock.ribs(got); expected.set(...bake.volumes.ribs).applyMatrix4(chest.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
      for (const kind of ['body', 'fore'] as const) {
        const volume = bake.volumes[kind], matrix = kind === 'body' ? body.matrixWorld : chest.matrixWorld;
        const e = matrix.elements, pitch = kind === 'body' ? bake.volumes.body.pitch : 0;
        if (kind === 'body') { clock.body(rear, front); axis.set(e[8], e[9], e[10]); }
        else { clock.fore(rear, front); axis.set(e[0], e[1], e[2]); }
        centre.set(...volume.at).applyMatrix4(matrix);
        axis.multiplyScalar(Math.cos(pitch)).addScaledVector(up.set(e[4], e[5], e[6]), Math.sin(pitch));
        expect(rear.distanceTo(expected.copy(centre).addScaledVector(axis, -volume.halfLength))).toBeLessThanOrEqual(EPSILON);
        expect(front.distanceTo(expected.copy(centre).addScaledVector(axis, volume.halfLength))).toBeLessThanOrEqual(EPSILON);
      }
    };
    clock.stage(pose); clock.publish(group.matrixWorld, 'head');
    check();
    for (let tick = 0; tick < 1200; tick++) {
      input.t = tick / 60; input.dt = tick % 3 === 0 ? 1 / 30 : 1 / 60;
      input.speed = 13 * (0.5 + 0.5 * Math.sin(input.t)); input.mem['act'] = 1 + Math.floor(tick / 120) % 4;
      input.attack = tick % 120 < 100 ? Math.min(tick % 120 / 60, 1) : -1;
      input.flinch = Math.max(0, Math.sin(input.t * 3)); input.brace = Math.max(0, Math.cos(input.t * 2)) * 0.7;
      input.lookWeight = 0.5 + 0.5 * Math.sin(input.t * 0.4); input.yaw = input.t * 0.3;
      advanceKingPose(input, bake.rest, pose);
      applyKingPose(rest, pose);
      group.position.set(150 + Math.sin(input.t), 4, -30); group.scale.setScalar(input.scale);
      group.rotation.set(Math.sin(input.t) * 0.1, input.yaw, Math.cos(input.t) * 0.08, 'YXZ');
      clock.stage(pose);
      // Posing/root motion have not published any matrixWorld: pre-render hit queries still see the old worlds.
      check();
      chest.updateWorldMatrix(true, false); clock.publish(group.matrixWorld, 'ribs');
      // Rib getWorldPosition updates body/chest; the head remains on its older clock.
      check();
      const saved = clock.snapshot(); restored.restore(saved);
      expect(restored.snapshot()).toEqual(saved);
      // Reusing the pose scratch cannot mutate the staged clock or saved arrays.
      pose.rootY += 17;
      if (tick % 2 === 0) {
        head.updateWorldMatrix(true, false);
        clock.publish(group.matrixWorld, 'head'); restored.publish(group.matrixWorld, 'head');
        check(); expect(restored.snapshot()).toEqual(clock.snapshot());
      }
      // The ordinary render pass eventually publishes every descendant, including an older cached head.
      group.updateMatrixWorld(true);
      clock.publish(group.matrixWorld, 'head'); restored.publish(group.matrixWorld, 'head');
      check(); expect(restored.snapshot()).toEqual(clock.snapshot());
    }
  });

  it('restores a mixed-clock checkpoint atomically and refuses malformed history without changing it', () => {
    const bake = readKingCollisionBake(raw), clock = new KingQueryPose(bake.joints, bake.volumes), pose = newPose();
    clock.stage(pose); clock.publish(new Matrix4(), 'head');
    pose.rootY = 0.7; pose.chestPitch = 0.3;
    clock.stage(pose); clock.publish(new Matrix4().makeTranslation(20, 0, 0), 'ribs');
    const saved = clock.snapshot(), clean = new KingQueryPose(bake.joints, bake.volumes);
    clean.restore(saved); expect(clean.snapshot()).toEqual(saved);
    const bad = structuredClone(saved); bad.published.right[2] = Number.NaN;
    expect(() => clean.restore(bad)).toThrow(); expect(clean.snapshot()).toEqual(saved);
    expect(() => clean.restore({ ...saved, extra: true })).toThrow(); expect(clean.snapshot()).toEqual(saved);
    pose.headYaw = Number.NaN;
    expect(() => clean.stage(pose)).toThrow('Invalid King query pose'); expect(clean.snapshot()).toEqual(saved);
    expect(() => clean.publish(new Matrix4().makeTranslation(Number.NaN, 0, 0), 'head')).toThrow('Invalid King query frame');
    expect(clean.snapshot()).toEqual(saved);
    saved.published.head[0] += 5;
    expect(clean.snapshot()).not.toEqual(saved);
  });
});

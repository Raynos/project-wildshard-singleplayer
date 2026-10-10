// oxlint-disable-next-line import/no-nodejs-modules -- Trusted bake freshness hashes the exact checked-out source/GLB bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The oracle reads the real committed GLB and source inputs, never renderer fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the trusted bake inputs relative to this test checkout.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { bakeKingCollision, readKingRig } from '../../../src/shards/pine-hollow/generators/bake-pine-king-collision.mjs';
import { advanceKingPose, applyKingPose, clipPose, newPose, type KingPoseInput } from '../../../src/shards/pine-hollow/combat/kingRig';
import { KingCollision } from '../../../src/shards/pine-hollow/runtime/kingCollision';
import { readKingCollisionBake } from '../../../src/shards/pine-hollow/runtime/kingCollisionBake';
import raw from '../../../src/shards/pine-hollow/runtime/kingCollision.baked.json';
import { withPortableMath } from '../../fake/portableMath';

const root = resolve(import.meta.dirname, '../../..');
const EPSILON = 1e-10; // World metres; below 0.0000001 mm, only double-precision matrix evaluation noise.

describe('the real King rig collision-only law', () => {
  it('has byte-identical deterministic bake output and exact input hashes', () => {
    const sin = Math.sin, cos = Math.cos;
    const bake = readKingCollisionBake(raw);
    expect(bakeKingCollision(root)).toEqual(bake);
    expect(bakeKingCollision(root)).toEqual(bake);
    expect(Math.sin).toBe(sin); expect(Math.cos).toBe(cos);
    for (const [path, hash] of Object.entries(bake.inputs)) {
      expect(createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'), path).toBe(hash);
    }
  });

  it('matches the old live-bone anchors at every authored fixed-step clip sample', () => withPortableMath(() => {
    const bake = readKingCollisionBake(raw), collision = new KingCollision(bake.joints, bake.volumes);
    const { group, rest } = readKingRig(root), pose = newPose();
    const got = new Vector3(), expected = new Vector3();
    for (const clip of bake.clips) for (const frame of clip.frames) {
      clipPose(pose, rest, clip.name, frame.phase, frame.tick / 60);
      collision.pose(pose, group.matrixWorld);
      applyKingPose(rest, pose); group.updateMatrixWorld(true);
      const names = ['body', 'chest', 'neck', 'head'] as const;
      for (let i = 0; i < 4; i++) {
        const matrix = frame.transforms[i], name = names[i];
        if (matrix === undefined || name === undefined) throw new Error('Missing baked sample');
        // Anchor samples independently retain the old visual FK matrices, including the real GLB rest translations.
        expect(rest.bones[name]?.matrixWorld.toArray()).toEqual(matrix);
      }
      collision.head(got);
      const head = rest.bones['head']; if (head === undefined) throw new Error('Missing real head');
      expected.set(...bake.volumes.head).applyMatrix4(head.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
    }
  }));

  it('matches live volumes throughout blended gait, attack/held fade, recoil, brace and target look', () => {
    const bake = readKingCollisionBake(raw), collision = new KingCollision(bake.joints, bake.volumes);
    const { group, rest, bones } = readKingRig(root), pose = newPose();
    const c: KingPoseInput = { dt: 1 / 60, t: 0, scale: 2.6, speed: 0, deathT: -1,
      flinch: 0, brace: 0, attack: -1, lookWeight: 0, yaw: 0, mem: {},
      lookTarget: new Vector3(), position: group.position };
    const got = new Vector3(), expected = new Vector3(), a = new Vector3(), b = new Vector3();
    const axis = new Vector3(), up = new Vector3(), centre = new Vector3();
    for (let tick = 0; tick < 1200; tick++) {
      c.t = tick / 60; c.dt = tick % 3 === 0 ? 1 / 30 : 1 / 60;
      c.speed = 13 * (0.5 + 0.5 * Math.sin(c.t)); c.mem['act'] = 1 + Math.floor(tick / 150) % 4;
      const phaseTick = tick % 150; c.attack = phaseTick < 120 ? Math.min(phaseTick / 60, 1) : -1;
      c.flinch = Math.max(0, Math.sin(c.t * 3)); c.brace = Math.max(0, Math.cos(c.t * 2)) * 0.7;
      c.lookWeight = 0.5 + 0.5 * Math.sin(c.t * 0.4); c.yaw = c.t * 0.3;
      c.lookTarget = { x: 170 + Math.sin(c.t) * 10, y: 2, z: -20 };
      group.position.set(150, 4, -30); group.scale.setScalar(c.scale);
      group.rotation.set(Math.sin(c.t) * 0.1, c.yaw, Math.cos(c.t) * 0.08, 'YXZ');
      advanceKingPose(c, bake.rest, pose);
      applyKingPose(rest, pose); group.updateMatrixWorld(true); collision.pose(pose, group.matrixWorld);
      const head = bones['head'], body = bones['body'], chest = bones['chest'];
      if (head === undefined || body === undefined || chest === undefined) throw new Error('Missing real joints');
      collision.head(got); expected.set(...bake.volumes.head).applyMatrix4(head.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
      collision.ribs(got); expected.set(...bake.volumes.ribs).applyMatrix4(chest.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
      for (const kind of ['body', 'fore'] as const) {
        const volume = bake.volumes[kind], matrix = kind === 'body' ? body.matrixWorld : chest.matrixWorld;
        const e = matrix.elements, pitch = kind === 'body' ? bake.volumes.body.pitch : 0;
        if (kind === 'body') { collision.body(a, b); axis.set(e[8], e[9], e[10]); }
        else { collision.fore(a, b); axis.set(e[0], e[1], e[2]); }
        centre.set(...volume.at).applyMatrix4(matrix);
        axis.multiplyScalar(Math.cos(pitch)).addScaledVector(up.set(e[4], e[5], e[6]), Math.sin(pitch));
        expected.copy(centre).addScaledVector(axis, -volume.halfLength);
        expect(a.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
        expected.copy(centre).addScaledVector(axis, volume.halfLength);
        expect(b.distanceTo(expected)).toBeLessThanOrEqual(EPSILON);
      }
    }
  });

  it('refuses unknown fields, invalid transforms and broken sample clocks', () => {
    expect(() => readKingCollisionBake({ ...raw, unexpected: true })).toThrow();
    const corrupt = structuredClone(raw); corrupt.clips[0]?.frames.pop();
    expect(() => readKingCollisionBake(corrupt)).toThrow('Invalid King collision sample clock');
    const nonfinite = structuredClone(raw); const frame = nonfinite.clips[0]?.frames[0];
    if (frame === undefined) throw new Error('Missing fixture frame'); frame.transforms[0]?.push(Number.NaN);
    expect(() => readKingCollisionBake(nonfinite)).toThrow();
  });
});

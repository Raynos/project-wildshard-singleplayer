// oxlint-disable-next-line import/no-nodejs-modules -- The volume oracle loads the actual committed King GLB.
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { readKingRig } from '../../../scripts/bake-pine-king-collision.mjs';
import { advanceKingPose, applyKingPose, newPose, type KingPose, type KingPoseInput } from '../../../src/shards/pine-hollow/combat/kingRig';
import { bindKingQueryView } from '../../../src/shards/pine-hollow/runtime/kingQueryView';
import { readKingCollisionBake } from '../../../src/shards/pine-hollow/runtime/kingCollisionBake';
import raw from '../../../src/shards/pine-hollow/runtime/kingCollision.baked.json';

it('keeps every old live volume at its original query clock and restores the exact page methods on retirement', () => {
  const { group, bones, rest } = readKingRig(resolve(import.meta.dirname, '../../..'));
  const bake = readKingCollisionBake(raw), head = bones['head'], body = bones['body'], chest = bones['chest'];
  if (head === undefined || body === undefined || chest === undefined) throw new Error('Missing actual King chain');
  const axis = new Vector3(), up = new Vector3(), centre = new Vector3();
  const oldCapsule = (kind: 'body' | 'fore', a: Vector3, b: Vector3): void => {
    const volume = bake.volumes[kind], matrix = kind === 'body' ? body.matrixWorld : chest.matrixWorld, e = matrix.elements;
    const pitch = kind === 'body' ? bake.volumes.body.pitch : 0;
    if (kind === 'body') axis.set(e[8], e[9], e[10]); else axis.set(e[0], e[1], e[2]);
    axis.multiplyScalar(Math.cos(pitch)).addScaledVector(up.set(e[4], e[5], e[6]), Math.sin(pitch));
    centre.set(...volume.at).applyMatrix4(matrix);
    a.copy(centre).addScaledVector(axis, -volume.halfLength); b.copy(centre).addScaledVector(axis, volume.halfLength);
  };
  const oldHead = (out: Vector3): Vector3 => out.set(...bake.volumes.head).applyMatrix4(head.matrixWorld);
  const oldBody = (a: Vector3, b: Vector3): void => { oldCapsule('body', a, b); };
  const oldFore = (a: Vector3, b: Vector3): boolean => { oldCapsule('fore', a, b); return true; };
  const view = { mesh: group, headWorld: oldHead, bodyCapsule: oldBody, foreCapsule: oldFore };
  let receive = (_pose: KingPose): void => undefined, removed = 0;
  const binding = bindKingQueryView(view, bake, listen => { receive = listen; return () => { removed++; }; });
  const pose = newPose(), input: KingPoseInput = { dt: 1 / 60, t: 0, scale: 2.6, speed: 0, deathT: -1,
    flinch: 0, brace: 0, attack: -1, lookWeight: 0, yaw: 0, mem: {}, position: group.position,
    lookTarget: { x: 12, y: 3, z: -20 } };
  const got = new Vector3(), expected = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3(), d = new Vector3();
  const check = (): void => {
    view.headWorld(got); oldHead(expected); expect(got.distanceTo(expected)).toBeLessThanOrEqual(1e-10);
    view.bodyCapsule(a, b); oldBody(c, d);
    expect(a.distanceTo(c)).toBeLessThanOrEqual(1e-10); expect(b.distanceTo(d)).toBeLessThanOrEqual(1e-10);
    expect(view.foreCapsule(a, b)).toBe(oldFore(c, d));
    expect(a.distanceTo(c)).toBeLessThanOrEqual(1e-10); expect(b.distanceTo(d)).toBeLessThanOrEqual(1e-10);
  };
  check();
  for (let tick = 0; tick < 1200; tick++) {
    input.t = tick / 60; input.speed = 13 * (0.5 + 0.5 * Math.sin(input.t)); input.yaw = input.t * 0.4;
    input.mem['act'] = 1 + Math.floor(tick / 120) % 4; input.attack = tick % 120 < 100 ? tick % 120 / 100 : -1;
    input.flinch = Math.max(0, Math.cos(input.t * 3)); input.brace = Math.max(0, Math.sin(input.t * 2));
    input.lookWeight = 0.5 + 0.5 * Math.sin(input.t);
    advanceKingPose(input, bake.rest, pose); applyKingPose(rest, pose); receive(pose);
    group.position.set(6 + Math.sin(input.t), 3, -4); group.scale.setScalar(input.scale);
    group.rotation.set(Math.sin(input.t) * 0.1, input.yaw, Math.cos(input.t) * 0.08, 'YXZ');
    check(); // cached pre-render volumes
    chest.updateWorldMatrix(true, false); binding.publishRibs();
    check(); // ribcage query changed parent worlds, retaining the older head
    binding.query.ribs(got); expected.set(...bake.volumes.ribs).applyMatrix4(chest.matrixWorld);
    expect(got.distanceTo(expected)).toBeLessThanOrEqual(1e-10);
    if (tick % 3 === 0) { head.updateWorldMatrix(true, false); binding.publishHead(); check(); }
    group.updateMatrixWorld(true); check(); // renderer invokes the installed publication wrapper
  }
  binding.dispose(); binding.dispose();
  expect(removed).toBe(1); expect(view.headWorld).toBe(oldHead); expect(view.bodyCapsule).toBe(oldBody); expect(view.foreCapsule).toBe(oldFore);
  // Later render calls advance the visual matrices without changing this retired collision owner.
  const saved = binding.query.snapshot(); group.position.x += 5; group.updateMatrixWorld(true);
  expect(binding.query.snapshot()).toEqual(saved);
});

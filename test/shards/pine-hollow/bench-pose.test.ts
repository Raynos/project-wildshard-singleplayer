// oxlint-disable-next-line import/no-nodejs-modules -- Fence the shipping callback's delegation to the shared law.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pineBenchPose } from '../../../src/shards/pine-hollow/quest/benchPose';

it('keeps the shipping seat arithmetic byte-exact across actual yaw/position inputs', () => {
  for (let sample = 0; sample < 10_000; sample++) {
    const yaw = sample / 97 - 40, at = { x: sample / 103 - 200, y: sample / 193, z: 180 - sample / 73 };
    expect(pineBenchPose(at, yaw)).toEqual({ x: at.x + Math.sin(yaw) * 0.2, y: at.y + 0.02,
      z: at.z + Math.cos(yaw) * 0.2, yaw: yaw + Math.PI, pitch: 0.05 });
  }
  const page = readFileSync('src/shards/pine-hollow/quest/index.ts', 'utf8');
  expect(page).toContain('const pose = pineBenchPose(at, yaw);');
  expect(page).toContain('player.velocity.set(0, 0, 0);');
  expect(page).toContain('player.yaw = pose.yaw; player.pitch = pose.pitch;');
});

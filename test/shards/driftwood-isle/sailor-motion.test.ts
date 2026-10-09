// oxlint-disable-next-line import/no-nodejs-modules -- Execute the exact shipping nonvisual animation lines as the oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A reviewed source hash fences the copied gameplay transition.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The source oracle has no renderer or fake rig.
import { Script } from 'node:vm';
import { MathUtils } from 'three';
import { expect, it } from 'vitest';
import { smoothstep } from '../../../src/engine/core/noise';
import { RISE_T } from '../../../src/shards/driftwood-isle/species/sailor';
import { stepSailorMotion } from '../../../src/shards/driftwood-isle/runtime/enemyBrains';

it('matches the actual shipping rise/sink and deck smoothing for 10k body frames, including a restored rise', () => {
  const source = readFileSync('src/shards/driftwood-isle/species/sailorPose.ts', 'utf8');
  const start = source.indexOf('  if (m.rising)'), body = source.slice(start, source.indexOf('  return up;', start));
  expect(createHash('sha256').update(body).digest('hex')).toBe('a3f1d56c75d2f18ded5d5fa8093729800724d2900c15d983e974416c4d94a60a');
  const script = new Script(`(() => { ${body} })()`);
  const native = { mem: { init: 1, rise: 0, rising: 1, sinking: 0, floor: 0.6 } as Record<string, number>, yOffset: -2.3 };
  const page = { mem: { ...native.mem }, yOffset: native.yOffset };
  let restored: typeof native | undefined;
  for (let tick = 0; tick < 10_000; tick++) {
    const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60;
    for (const actor of [native, page, ...(restored === undefined ? [] : [restored])]) {
      if (tick === 600) { actor.mem['sinking'] = 1; actor.mem['rising'] = 0; }
      if (tick === 900) { actor.mem['rising'] = 1; actor.mem['sinking'] = 0; }
      actor.mem['floor'] = tick < 1200 ? 0.6 : 0.2;
    }
    script.runInNewContext({ m: page.mem, a: page, dt, RISE_T, smooth01: (t: number) => smoothstep(0, 1, t), L: MathUtils.lerp });
    stepSailorMotion(native, dt);
    expect(native).toEqual(page);
    if (tick === 30) restored = { mem: { ...native.mem }, yOffset: native.yOffset };
    else if (restored !== undefined) { stepSailorMotion(restored, dt); expect(restored).toEqual(native); }
  }
}, 15_000);


it('keeps the renderer-free rise transition inside the shipping animation distance fence', () => {
  const page = readFileSync('src/engine/entities/AnimalManager.ts', 'utf8');
  const keeper = readFileSync('src/shards/driftwood-isle/runtime/keeper.ts', 'utf8');
  const distance = /const ANIM_LOD = (\d+);/u.exec(page)?.[1];
  expect(distance).toBeDefined(); expect(keeper).toContain(`const ANIM_LOD = ${String(distance)};`);
  expect(keeper).toContain("poses.get(id)?.advance(dt, host.clock.now, poseNear);");
});

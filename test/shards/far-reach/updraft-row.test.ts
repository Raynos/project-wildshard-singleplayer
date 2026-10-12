import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { UpdraftDriver } from '@wildshard/game/plugin/mover';
import { SKY_UPDRAFT } from '../../../src/shards/far-reach/data/modes';
import { inUpdraft as nativeInUpdraft } from '../../fixtures/modes/nativeUpdraft';

it('preserves the shipping Sky wind impulse and hover gate on every fixed tick and open boundary', () => {
  const force = new UpdraftDriver(SKY_UPDRAFT), impulse = new Vector3();
  const row = SKY_UPDRAFT, dx = row.to.x - row.from.x, dz = row.to.z - row.from.z, len = Math.hypot(dx, dz);
  const point = (along: number, across: number, y: number) => ({
    x: row.from.x + dx * along / len - dz * across / len,
    y,
    z: row.from.z + dz * along / len + dx * across / len,
  });
  const halfWidth = row.width / 2 + row.margin, ceiling = row.to.y + row.margin;
  const positions = [point(0, 0, 0), point(len, 0, 0), point(len / 2, halfWidth, 0),
    point(len / 2, -halfWidth, 0), point(len / 2, 0, ceiling), point(len / 2, 0, -1000)];
  let seed = 435;
  const rand = (): number => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  for (let tick = 0; tick < 10_000; tick++) positions.push(point(rand() * (len + 2) - 1, (rand() * 2 - 1) * (halfWidth + 1), ceiling - 100 + rand() * 101));
  for (let tick = 0; tick < positions.length; tick++) {
    const feet = positions[tick]; if (feet === undefined) throw new Error('Missing sampled feet');
    for (const hover of [false, true]) {
      const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60;
      const expected = hover && nativeInUpdraft(feet.x, feet.y, feet.z) ? new Vector3(0, 12 * dt, 0) : new Vector3();
      force.step(dt, feet, hover, impulse.set(0, 0, 0));
      expect(impulse).toEqual(expected);
    }
  }
});

import { expect, it } from 'vitest';
import { createClientChannels } from '../../../src/game/plugin/ui';
import { NINE_CLIENT_CHANNELS } from '../../../src/shards/nine-dragon-stack/data/clientMotion';
import { MOVERS } from '../../../src/shards/nine-dragon-stack/data/worldDressing';
import { NINE_FLOOR_PLAN } from '../../../src/shards/nine-dragon-stack/data/floorPlan';

// Independent original page equations from runtime/props/pathMovers.ts, preserved as an exact scalar oracle.
function original(time: number) {
  const datum = NINE_FLOOR_PLAN.datum, g = MOVERS.gondola, x0 = NINE_FLOOR_PLAN.well.x0, x1 = NINE_FLOOR_PLAN.well.x1;
  const x = x0 + g.margin + (x1 - x0 - g.margin * 2) * (0.5 + 0.5 * Math.sin(time * g.rate + g.phase));
  return [
    { x: MOVERS.train.x + ((time * MOVERS.train.speed) % MOVERS.train.length), y: datum + MOVERS.train.y, z: MOVERS.train.z },
    { x, y: datum - 16 + ((x - x0) / (x1 - x0)) * g.rise, z: -12 },
    ...MOVERS.drones.map(p => {
      const a = time * p.rate + p.phase;
      return { x: p.x + Math.cos(a) * p.r, y: datum + p.y + Math.sin(time * p.bobRate + p.phase) * p.bob, z: p.z + Math.sin(a) * p.r, yaw: -a };
    }),
  ];
}

it('keeps every decorative transform bit-exact at 10k continuous times, 300m loop seams and unwrapped yaw', () => {
  const views = NINE_CLIENT_CHANNELS.map(createClientChannels), period = MOVERS.train.length / MOVERS.train.speed;
  const times = [0, -0, -1, period - 1e-12, period, period + 1e-12, 1e6 + 0.1234567,
    ...Array.from({ length: 10000 }, (_, n) => n * (1 / 59.94) + Math.sin(n) * 0.001)];
  for (const time of times) {
    const expected = original(time);
    for (const [index, view] of views.entries()) {
      view.evaluate({ time, delta: 1 / 59.94, values: [] });
      const pose = expected[index]; if (pose === undefined) throw new Error('Missing original mover');
      for (const [property, value] of Object.entries(pose)) expect(Object.is(Reflect.get(view.frame, property), value), `${view.reads.join(',')}:${index}:${property}:${time}`).toBe(true);
    }
  }
});

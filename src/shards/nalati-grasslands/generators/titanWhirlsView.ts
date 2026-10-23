import { ARENA_VIEW, arenaFunnel } from '@wildshard/format/arenaView';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import { TITAN_WHIRLS } from './stormTitanFight';

/**
 * Nalati zero R6: the Storm Titan's whirlwinds' funnels and debris as a view program (behaviour/titanWhirlsView.as) at the
 * fight's whirl slot. Samples, in the order the module reads them: per whirlwind its ease, shown, x, ground and z (the
 * fight's values: the ease and the gate stay the fight's, they decide which laws step), the clock, then TITAN_WHIRLS's
 * funnel sink, spin and breathe and its debris spiral (count, climb, turn, step, radius, height, the roll axis made unit,
 * roll, scale). Transforms: each funnel. Batch: the shown whirlwinds' debris, packed.
 */
export function nalatiTitanWhirlsView(): ViewProgramRows {
  const whirls = ARENA_VIEW.whirls, d = TITAN_WHIRLS.debris, [ax = 0, ay = 0, az = 0] = d.axis, unit = Math.hypot(ax, ay, az);
  const constant = (n: number) => ({ kind: 'constant' as const, value: n });
  return { slot: whirls.slot, before: [], budget: { pages: 1, ioBytes: 16384, fuel: 500_000, targetMs: .5 },
    pools: [],
    samples: [...TITAN_WHIRLS.laws.flatMap((_, i) => whirls.fields.map(field => ({ kind: 'value' as const, source: whirls.values, field: `${field}${String(i)}` }))),
      { kind: 'clock' }, ...[TITAN_WHIRLS.sink, TITAN_WHIRLS.spin, ...TITAN_WHIRLS.breathe, d.count, d.climb, d.turn, d.step, ...d.radius, d.height,
        ax / unit, ay / unit, az / unit, d.roll, ...d.scale].map(constant)],
    channels: [], transforms: TITAN_WHIRLS.laws.map((_, i) => ({ kind: 'object' as const, object: arenaFunnel(i) })),
    batches: [{ draw: whirls.draws.debris, capacity: TITAN_WHIRLS.laws.length * d.count }],
    bounds: { translation: 4000, scale: [0, 40], shear: .02 } };
}

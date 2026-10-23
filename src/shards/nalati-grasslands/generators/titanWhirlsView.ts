import { ARENA_VIEW, arenaFunnel } from '@wildshard/format/arenaView';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import { TITAN_WHIRLS } from './stormTitanFight';

/**
 * Nalati zero R6: the Storm Titan's whirlwinds' funnels and debris as a view program (behaviour/titanWhirlsView.as) at the
 * fight's whirl slot. Samples, in the order the module reads them: the clock, TITAN_WHIRLS's funnel sink, spin and
 * breathe, its debris spiral (count, climb, turn, step, radius, height, the roll axis made unit, roll, scale) and the
 * whirlwind count, then per whirlwind its ease, shown, x, ground and z (the fight's values: the ease and the gate stay
 * the fight's, they decide which laws step). Transforms: each funnel. Batch: the shown whirlwinds' debris, packed.
 */
export function nalatiTitanWhirlsView(): ViewProgramRows { return whirlsViewRows(TITAN_WHIRLS); }

/** Any whirlwinds' view rows (the Titan's above; a test's made-up dust devils too). */
export function whirlsViewRows(rows: { readonly laws: readonly unknown[]; readonly sink: number; readonly spin: number; readonly breathe: readonly number[];
  readonly debris: { readonly count: number; readonly climb: number; readonly turn: number; readonly step: number; readonly radius: readonly number[]; readonly height: number;
    readonly axis: readonly number[]; readonly roll: number; readonly scale: readonly number[] } }): ViewProgramRows {
  const whirls = ARENA_VIEW.whirls, d = rows.debris, [ax = 0, ay = 0, az = 0] = d.axis, unit = Math.hypot(ax, ay, az);
  const constant = (n: number) => ({ kind: 'constant' as const, value: n });
  return { slot: whirls.slot, before: [], budget: { pages: 1, ioBytes: 16384, fuel: 500_000, targetMs: .5 },
    pools: [],
    samples: [{ kind: 'clock' }, ...[rows.sink, rows.spin, ...rows.breathe, d.count, d.climb, d.turn, d.step, ...d.radius, d.height,
        ax / unit, ay / unit, az / unit, d.roll, ...d.scale, rows.laws.length].map(constant),
      ...rows.laws.flatMap((_, i) => whirls.fields.map(field => ({ kind: 'value' as const, source: whirls.values, field: field + String(i) })))],
    channels: [], transforms: rows.laws.map((_, i) => ({ kind: 'object' as const, object: arenaFunnel(i) })),
    batches: [{ draw: whirls.draws.debris, capacity: rows.laws.length * d.count }],
    bounds: { translation: 4000, scale: [0, 40], shear: .02 } };
}

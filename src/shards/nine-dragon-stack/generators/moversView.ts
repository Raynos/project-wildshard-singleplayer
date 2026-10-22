import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import plan from '../data/layoutPlan.json' with { type: 'json' };
import worldDressingRows from '../data/worldDressing.json' with { type: 'json' };

const { MOVERS } = worldDressingRows;
const datum = plan.Y0;
/** the gondola's cable across the Well, 16 m under the square, 12 m north of its centre line */
const cable = { x0: plan.WELL.x0, x1: plan.WELL.x1, y: datum - 16, z: -12 };

/** Each mover's world-entry stage: it places the mover and lends its object to the view program (generators/worldAssembly). */
export const MOVER_STAGES = ['nds-train', 'nds-gondola', ...MOVERS.drones.map((_, i) => `nds-drone-${String(i)}`)] as const;
/** Where each mover stands at page time 0: its placement's one pose until the module's first frame. */
const gondolaX = cable.x0 + MOVERS.gondola.margin + (cable.x1 - cable.x0 - MOVERS.gondola.margin * 2) * (0.5 + 0.5 * Math.sin(MOVERS.gondola.phase));
export const MOVER_REST = [
  { x: MOVERS.train.x, y: datum + MOVERS.train.y, z: MOVERS.train.z, yaw: 0 },
  { x: gondolaX, y: cable.y + (gondolaX - cable.x0) / (cable.x1 - cable.x0) * MOVERS.gondola.rise, z: cable.z, yaw: 0 },
  ...MOVERS.drones.map(path => ({ x: path.x + path.r * Math.cos(path.phase), y: datum + path.y + Math.sin(path.phase) * path.bob, z: path.z + path.r * Math.sin(path.phase), yaw: 0 - path.phase })),
];

/** Nine's movers as a view program (behaviour/movers.as): the page clock then constants in the module's order, one transform per mover. */
export function nineMoversView(): ViewProgramRows {
  const constant = (value: number) => ({ kind: 'constant' as const, value });
  const train = MOVERS.train, gondola = MOVERS.gondola;
  return { system: 'shard.nd.movers', before: [], budget: { pages: 1, ioBytes: 4096, fuel: 100_000, targetMs: .5 }, pools: [],
    samples: [{ kind: 'clock' as const }, ...[train.x, datum + train.y, train.z, train.speed, train.length, cable.x0, cable.x1, cable.y, cable.z,
      gondola.margin, gondola.rise, gondola.rate, gondola.phase, MOVERS.drones.length,
      ...MOVERS.drones.flatMap(path => [path.x, datum + path.y, path.z, path.r, path.rate, path.phase, path.bobRate, path.bob])].map(constant)],
    channels: [], transforms: MOVER_STAGES.map(object => ({ kind: 'object' as const, object })),
    bounds: { translation: 400, scale: [0.999, 1.001], shear: 0.001 } };
}

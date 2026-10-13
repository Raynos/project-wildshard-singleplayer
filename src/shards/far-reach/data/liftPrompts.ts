import { ClientChannels } from '@wildshard/sdk/clientChannels';
import entries from './islets.generated.json' with { type: 'json' };
import { APOTHEM } from './layout';
import { ISLET, ISLET_EDGES } from './isletDesign';
import { STRINGS } from './strings';

const away = -1e5, radius = ISLET.islet.r * APOTHEM;
const rows = entries.entries.flatMap(entry => {
  const edge = ISLET_EDGES.find(value => value === entry.edge);
  if (edge === undefined) throw new Error('Unknown authored lift edge');
  const dx = entry.dock.x - entry.rest.x, dz = entry.dock.z - entry.rest.z;
  const inverse = 1 / (Math.sqrt(dx * dx + 0 + dz * dz) || 1);
  const rim = { x: entry.dock.x + dx * inverse * (radius + 1.5), y: entry.gate.y + 1,
    z: entry.dock.z + dz * inverse * (radius + 1.5) };
  return ([1, 2, 3] as const).map(action => {
    const id = `far.islet.${entry.edge}.prompt.${action}`, row = new ClientChannels(id);
    row.fromMover(`far.islet.${entry.edge}`);
    const x = row.read('position.x'), y = row.read('position.y'), z = row.read('position.z');
    const distance = (at: { x: number; y: number; z: number }): number => row.hypot3(
      row.binary('sub', x, row.constant(at.x)), row.binary('sub', y, row.constant(at.y)), row.binary('sub', z, row.constant(at.z)));
    const road = row.binary('gt', row.constant(0.001), distance(entry.rest));
    const top = row.binary('gt', row.constant(0.001), distance(entry.dock));
    const fixed = action === 2 ? entry.landing : rim;
    row.output('x', action === 1 ? x : row.constant(fixed.x));
    row.output('z', action === 1 ? z : row.constant(fixed.z));
    row.output('y', action === 1 ? row.select(row.binary('max', road, top), row.binary('add', y, row.constant(1)), row.constant(away))
      : row.select(action === 2 ? top : road, row.constant(action === 2 ? 1 : rim.y), row.constant(away)));
    const initial = action === 1 ? entry.rest : fixed;
    row.prompt({ id, label: action === 1 ? STRINGS.rideIslet : STRINGS.callIslet, radius: action === 1 ? radius + 0.05 : 3,
      at: [initial.x, away, initial.z], action: { kind: 'socketLift', edge, action } });
    return row.build();
  });
});
/** Original ordered RIDE, CALL-down and CALL-up prompts; thresholds use the same three-axis hypot. */
export const SKY_LIFT_PROMPTS = rows;

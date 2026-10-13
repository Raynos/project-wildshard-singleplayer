import { ClientChannels } from '@wildshard/sdk/clientChannels';
import entries from '../data/islets.generated.json' with { type: 'json' };
import rig from '../data/isletRig.json' with { type: 'json' };

const pitch = 0.46;
type Triple = [number, number, number];
const capacities = entries.entries.map((entry, index) => {
  const row = rig.rigs[index]; if (row === undefined) throw new Error('Missing authored chain ends');
  return Math.max(...row.local.map((local, at) => {
    const top = row.tops[at < 2 ? 0 : 1];
    const [x, y, z] = local, tx = top?.[0], ty = top?.[1], tz = top?.[2];
    if (x === undefined || y === undefined || z === undefined || tx === undefined || ty === undefined || tz === undefined) throw new Error('Missing chain coordinate');
    const dx = entry.rest.x + x - tx, dy = entry.rest.y + y - ty, dz = entry.rest.z + z - tz;
    return Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz) / pitch) + 2;
  }));
});
const offsets = capacities.map((_, index) => capacities.slice(0, index).reduce((sum, value) => sum + value * 4, 0));
const railsPerEntry = Math.max(...rig.rails.map(rows => rows.length));
/** Exact rest allocation sizes; the existing instance meshes remain the storage owners. */
const ISLET_VIEW_COUNTS = { links: capacities.reduce((sum, value) => sum + value * 4, 0), gates: entries.entries.length,
  rails: entries.entries.length * railsPerEntry };
/** Initial poses belong only to private rendering; they grant no native body or fixed clock. */
const ISLET_VIEW_REST = entries.entries.flatMap(entry => [
  { id: `far.islet.${entry.edge}`, position: { ...entry.rest }, euler: { x: 0, y: 0, z: 0 }, enabled: true },
  { id: `far.islet.${entry.edge}.gate`, position: { x: entry.gateBar.x, y: entry.gateBar.y, z: entry.gateBar.z }, euler: { x: 0, y: 0, z: 0 }, enabled: false },
]);

const rows = entries.entries.flatMap((entry, index) => {
  const row = new ClientChannels(`far.islet.${entry.edge}.view`); row.fromMover(`far.islet.${entry.edge}`);
  const zero = row.constant(0), one = row.constant(1), x = row.read('position.x'), y = row.read('position.y'), z = row.read('position.z');
  for (const [property, node] of [['x', x], ['y', y], ['z', z]] as const) { row.output(property, node); row.bind(property, `islet.${entry.edge}`); }
  const cache = row.binary('add', row.binary('add', row.binary('mul', x, row.constant(1e-3)), y), row.binary('mul', z, row.constant(1e-6)));
  const atRest = row.binary('gt', row.constant(0.001), row.hypot3(row.binary('sub', x, row.constant(entry.rest.x)),
    row.binary('sub', y, row.constant(entry.rest.y)), row.binary('sub', z, row.constant(entry.rest.z))));
  const chain = rig.rigs[index], capacity = capacities[index], offset = offsets[index];
  if (chain === undefined || capacity === undefined || offset === undefined) throw new Error('Missing authored chain allocation');
  for (const [at, local] of chain.local.entries()) {
    const top = chain.tops[at < 2 ? 0 : 1], lx = local[0], ly = local[1], lz = local[2], tx = top?.[0], ty = top?.[1], tz = top?.[2];
    if (lx === undefined || ly === undefined || lz === undefined || tx === undefined || ty === undefined || tz === undefined) throw new Error('Missing chain coordinate');
    row.connector({ target: 'links', from: [row.binary('add', x, row.constant(lx)), row.binary('add', y, row.constant(ly)), row.binary('add', z, row.constant(lz))],
      to: [row.constant(tx), row.constant(ty), row.constant(tz)], scale: [one, one, one], enabled: one, aim: [0, 1, 0],
      turn: { axis: [0, 1, 0], radians: Math.PI / 2, alternate: true }, instances: { start: offset + at * capacity, capacity, pitch }, cache });
  }
  const railRows = rig.rails[index]; if (railRows === undefined) throw new Error('Missing authored rail allocation');
  for (let at = 0; at < railsPerEntry; at++) {
    const rail = railRows[at], box = rail?.box;
    const from: Triple = box === undefined ? [zero, zero, zero] : [row.constant(box.x), row.constant(box.y), row.constant(box.z)];
    const scale: Triple = box === undefined ? [zero, zero, zero] : [row.constant(2 * box.hx), row.constant(2 * box.hy), row.constant(2 * box.hz)];
    row.connector({ target: 'rails', from, to: from, scale, enabled: rail === undefined ? zero : atRest,
      ...(rail === undefined ? {} : { turn: { axis: [0, 1, 0] as Triple, radians: -rail.a, alternate: false } }),
      instances: { start: index * railsPerEntry + at, capacity: 1 }, cache: atRest });
  }
  const gate = new ClientChannels(`far.islet.${entry.edge}.gate.view`); gate.fromMover(`far.islet.${entry.edge}.gate`);
  const enabled = gate.read('enabled'), box = entry.gateBar;
  const from: Triple = [gate.constant(box.x), gate.constant(box.y), gate.constant(box.z)];
  gate.connector({ target: 'gates', from, to: from, scale: [gate.constant(2 * box.hx), gate.constant(2 * box.hy), gate.constant(2 * box.hz)],
    enabled, instances: { start: index, capacity: 1 }, cache: enabled });
  return [row.build(), gate.build()];
});
/** Native poses are copied in the existing late visual phase; these rows own neither collision nor motion. */
export function isletMotionRows(): { counts: typeof ISLET_VIEW_COUNTS; rest: typeof ISLET_VIEW_REST; channels: typeof rows } { return { counts: ISLET_VIEW_COUNTS, rest: ISLET_VIEW_REST, channels: rows }; }

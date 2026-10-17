import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

const outputs: NumericChannelOutput[] = [];
for (const name of ['FL_carpus', 'FR_carpus', 'FL_fetlock', 'FR_fetlock', 'BL_stifle', 'BR_stifle', 'BL_hock', 'BR_hock']) {
  outputs.push({ target: name, path: ['rotation', 'x'], expr: (b, read) => b.binary('mul', read(name, ['rotation', 'x']), b.constant(.3)) });
}
outputs.push({ target: 'neck1', path: ['rotation', 'x'], expr: (b, read) => b.binary('add', read('neck1', ['rotation', 'x']), b.constant(.1)) });
for (const axis of ['x', 'y', 'z'] as const) outputs.push({ target: 'head', path: ['rotation', axis], expr: (b, read) => {
  const mul = (a: number, c: number) => b.binary('mul', a, c), add = (a: number, c: number) => b.binary('add', a, c);
  const wave = b.binary('max', b.constant(0), b.unary('sin', add(mul(read('frame', ['t']), b.constant(4.6)), mul(read('frame', ['seed']), b.constant(7.1)))));
  const power = b.binary('pow', wave, b.constant(14));
  const base = read('head', ['rotation', axis]);
  if (axis === 'x') return add(base, add(b.constant(.08), mul(b.constant(.1), power)));
  const side = b.select(b.binary('gt', b.unary('sin', mul(read('frame', ['seed']), b.constant(13.7))), b.constant(0)), b.constant(1), b.constant(-1));
  return add(base, mul(mul(b.constant(axis === 'y' ? .35 : .3), power), side));
} });
outputs.push({ target: 'body', path: ['rotation', 'z'], expr: (b, read) => {
  const moving = b.binary('min', b.constant(1), b.binary('div', b.unary('abs', read('frame', ['speed'])), b.constant(1.2)));
  const wave = b.unary('sin', b.binary('mul', b.binary('mul', read('frame', ['phase']), b.constant(Math.PI)), b.constant(2)));
  return b.binary('add', read('body', ['rotation', 'z']), b.binary('mul', b.binary('mul', b.constant(.05), moving), wave));
} });
export const THRALL_CLIPS = { group: 'creature.pose', variant: 'thrall', alive: true,
  programs: outputs.flatMap((row, i) => numericChannelPrograms(`thrall.${i}`, 'creature.pose', [{ ...row, target: `joint.${row.target.replaceAll('_', '.')}`, expr: (b, read) => row.expr(b, (owner, path) => read(owner === 'frame' ? owner : `read.joint.${owner.replaceAll('_', '.')}`, path)) }])) };

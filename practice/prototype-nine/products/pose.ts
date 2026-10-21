import { numericChannelPrograms, type NumericChannelOutput } from '../../../src/sdk/clientChannels';

/** New deliberately simple WIP motion, not a claim that native source animation passed review.
 * Uses the real legacy attack fraction, speed and gait phase. Bind translations stay intact.
 * Medusa's explicit hover pose is presentation, not a physical corpse contact correction. */
export function prototypePose(id: string, joints: readonly string[], bodyY: number): { group: string; states: string[]; scalars: never[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const outputs: NumericChannelOutput[] = [];
  outputs.push({ target: 'joint.body', path: ['position', 'y'], expr: b => b.constant(bodyY) });
  for (const [index, name] of joints.entries()) {
    if (name === 'body') continue;
    const leg = /^(leg|FL_|FR_|BL_|BR_)/u.test(name);
    const expressive = /^(head|bell|jaw|clapper|bloom|.*Head|.*Lid)/u.test(name);
    const ribbon = name.startsWith('ribbon');
    if (!leg && !expressive && !ribbon && !name.startsWith('tail')) continue;
    outputs.push({ target: `joint.${name.replaceAll('_', '.')}`, path: ['rotation', 'x'], expr: (b, read) => {
      const n = (value: number) => b.constant(value);
      const mul = (a: number, c: number) => b.binary('mul', a, c);
      const add = (a: number, c: number) => b.binary('add', a, c);
      const attack = read('frame', ['attack']);
      const active = b.binary('gt', attack, n(-0.5));
      const phase = b.binary('max', n(0), b.binary('min', n(1), attack));
      const tell = mul(active, b.unary('sin', mul(phase, n(Math.PI * 2))));
      const gait = mul(b.binary('min', n(1), read('frame', ['speed'])),
        b.unary('sin', add(mul(read('frame', ['phase']), n(Math.PI * 2)), n(index % 2 === 0 ? 0 : Math.PI))));
      const idle = b.unary('sin', add(mul(read('frame', ['t']), n(2)), n(index * .6)));
      return leg ? mul(n(.12), gait)
        : add(mul(n(expressive ? -.24 : .06), tell), mul(n(ribbon ? .035 : .02), idle));
    } });
  }
  return { group: 'creature.pose', states: ['idle', 'sidestep', 'attack', 'flee'], scalars: [],
    programs: outputs.flatMap((row, index) => numericChannelPrograms(`${id}.prototype.${index}`, 'creature.pose', [row])) };
}

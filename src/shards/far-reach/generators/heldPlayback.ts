import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { FAN_VIEW } from '../data/fanView';

/** Compile the original held fan rows into bounded private visual channels. */
export function heldPlayback(): Record<string, ReturnType<ClientChannels['build']>[]> {
  const groups: Record<string, ReturnType<ClientChannels['build']>[]> = {};
  for (const motion of ['swing', 'heavy', 'gust'] as const) {
    const view = FAN_VIEW, hold = view.hold, draw = view.draw;
    const g = new ClientChannels(`fan.${motion}`), k = g.read('phase'), zero = g.constant(0), one = g.constant(1);
    const c = g.select(g.binary('gt', one, k), zero, g.read('charge'));
    const breath = g.unary('sin', g.binary('mul', g.clock('time'), g.constant(view.breath.rate)));
    const pose = (axis: 'x' | 'y' | 'z' | 'pitch' | 'yaw' | 'roll') => g.sample(k, view.motions[motion].keys.map(key => [key[0], key[1][axis]] as const), 'smoothstep');
    const add = (a: number, b: number) => g.binary('add', a, b), mul = (a: number, b: number) => g.binary('mul', a, b);
    g.output('x', add(add(g.constant(hold.x), pose('x')), mul(c, g.constant(draw.x))));
    g.output('y', add(add(add(g.constant(hold.y), pose('y')), mul(breath, g.constant(view.breath.lift))), mul(c, g.constant(draw.y))));
    g.output('z', add(add(g.constant(hold.z), pose('z')), mul(c, g.constant(draw.z))));
    g.output('pitch', add(add(add(g.constant(hold.pitch), pose('pitch')), mul(breath, g.constant(view.breath.pitch))), mul(c, g.constant(draw.pitch))));
    g.output('yaw', add(add(add(g.constant(hold.yaw), g.read('spring')), pose('yaw')), mul(c, g.constant(draw.yaw))));
    g.output('roll', g.binary('sub', add(g.constant(hold.roll), pose('roll')), mul(c, g.constant(draw.roll))));
    g.output('visible', mul(g.binary('gt', g.constant(view.hideAt), g.read('holster')), g.binary('gt', one, g.read('stowed'))));
    for (const property of ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'visible'] as const) g.bind(property, 'root');
    const pend = new ClientChannels(`pendant.${motion}`), phase = pend.read('phase'), z = pend.constant(0), full = pend.constant(1);
    const charge = pend.select(pend.binary('gt', full, phase), z, pend.read('charge'));
    const roll = pend.sample(phase, view.motions[motion].keys.map(key => [key[0], key[1].roll] as const), 'smoothstep');
    const plumb = pend.unary('neg', pend.binary('sub', pend.binary('add', pend.constant(hold.roll), roll), pend.binary('mul', charge, pend.constant(draw.roll))));
    const sway = pend.binary('mul', pend.unary('sin', pend.binary('mul', pend.clock('time'), pend.constant(view.pendant.rate))), pend.constant(view.pendant.sway));
    const swish = pend.select(pend.binary('gt', full, phase), pend.unary('sin', pend.binary('mul', phase, pend.constant(Math.PI))), z);
    pend.output('roll', pend.binary('add', pend.binary('add', plumb, sway), pend.binary('mul', swish, pend.constant(motion === 'swing' ? -view.pendant.swish : view.pendant.swish))));
    pend.bind('roll', 'pendant'); groups[motion] = [g.build(), pend.build()];
  }
  return groups;
}

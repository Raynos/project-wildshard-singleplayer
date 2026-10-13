import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { LASH_CORD, WHIP_VIEW } from '../data/whip';

/** Compile the original grip flick and root observations without changing the contact clock. */
export function heldPlayback(): Record<string, ReturnType<ClientChannels['build']>[]> {
  const root = new ClientChannels('lash.root');
  root.output('yaw', root.read('spring')); root.bind('yaw', 'root');
  root.output('visible', root.binary('gt', root.constant(0.5), root.read('holster'))); root.bind('visible', 'root');
  const grip = new ClientChannels('lash.grip'), ext = grip.read('ext'), slack = grip.read('slack');
  const rest = grip.binary('sub', grip.constant(1), slack), growing = grip.binary('gt', grip.constant(1), ext);
  grip.output('x', grip.constant(0));
  grip.output('y', grip.select(growing, grip.binary('mul', grip.constant(WHIP_VIEW.flick.lift), ext), grip.binary('mul', grip.constant(WHIP_VIEW.flick.lift), rest)));
  grip.output('z', grip.select(growing, grip.binary('mul', grip.constant(WHIP_VIEW.flick.push), ext), grip.binary('mul', grip.constant(WHIP_VIEW.flick.push), rest)));
  for (const property of ['x', 'y', 'z'] as const) grip.bind(property, 'grip');
  const reset = new ClientChannels('lash.rest');
  for (const property of ['x', 'y', 'z'] as const) { reset.output(property, reset.constant(0)); reset.bind(property, 'grip'); }
  const cord = new ClientChannels('lash.cord'), flick = WHIP_VIEW.flick;
  const scalar = (key: string) => cord.read(key), c = (n: number) => cord.constant(n);
  const add = (a: number, b: number) => cord.binary('add', a, b), sub = (a: number, b: number) => cord.binary('sub', a, b), mul = (a: number, b: number) => cord.binary('mul', a, b);
  const tension = scalar('taut'), cordSlack = scalar('slack'), cordExt = scalar('ext');
  cord.deformTube({ kind: 'tubeCurve', target: 'cord', segments: LASH_CORD.segments, radial: LASH_CORD.radial,
    from: [add(scalar('tipX'), scalar('gripX')), add(scalar('tipY'), scalar('gripY')), add(scalar('tipZ'), scalar('gripZ'))],
    to: [cord.select(tension, scalar('caughtX'), cord.unary('neg', scalar('modelX'))),
      cord.select(tension, scalar('caughtY'), sub(cord.unary('neg', scalar('modelY')), mul(cordSlack, c(flick.drop)))),
      cord.select(tension, scalar('caughtZ'), add(add(cord.unary('neg', scalar('reach')), c(flick.lead)), mul(cordSlack, c(flick.back))))],
    extent: cord.select(tension, c(1), cord.binary('min', c(1), mul(cordExt, sub(c(1), mul(cordSlack, c(flick.loosen)))))),
    wave: cord.select(tension, c(flick.tautSag), add(c(flick.sag[0]), mul(cordSlack, c(flick.sag[1])))),
    bend: [Math.PI, .7], ripple: [9, 40, .25], drop: [3.1, .05], radius: [.0045, 2.5, .0022, .93, .002],
  });
  return { root: [root.build()], active: [grip.build()], rest: [reset.build()], cord: [cord.build()] };
}

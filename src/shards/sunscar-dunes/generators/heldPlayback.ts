import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { WHIP_VIEW } from '../data/whip';

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
  return { root: [root.build()], active: [grip.build()], rest: [reset.build()] };
}

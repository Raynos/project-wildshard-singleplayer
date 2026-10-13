import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { STRINGS } from './strings';

const bucket = new ClientChannels('sunscar.well.bucket');
const progress = bucket.local({ read: 'oil.loaded' }), animated = bucket.local(0);
const raised = bucket.read('well.raised'), drop = bucket.read('well.drop');
const zero = bucket.constant(0), one = bucket.constant(1), axle = bucket.constant(1.85), top = bucket.constant(0.5);
const active = bucket.select(raised, bucket.binary('gt', one, progress), zero);
const advanced = bucket.binary('min', one, bucket.binary('add', progress,
  bucket.binary('div', bucket.clock('delta'), bucket.constant(1.2))));
const next = bucket.select(active, advanced, progress), moved = bucket.select(active, one, animated);
bucket.retain(progress, next); bucket.retain(animated, moved);
const rest = bucket.binary('sub', axle, drop), loaded = bucket.binary('sub', axle, top);
const height = bucket.binary('add', rest, bucket.binary('mul', bucket.binary('sub', drop, top), next));
const rope = bucket.binary('sub', one, bucket.binary('mul', next, bucket.constant(0.8)));
bucket.output('y', bucket.select(moved, height, bucket.select(progress, loaded, rest)));
bucket.output('scaleY', bucket.select(moved, rope, bucket.select(progress, bucket.constant(0.2), one)));
const finalHeight = bucket.select(moved, height, bucket.select(progress, loaded, rest));
const finalScale = bucket.select(moved, rope, bucket.select(progress, bucket.constant(0.2), one));
bucket.connector({ target: 'bucket', from: [zero, finalHeight, zero], to: [zero, finalHeight, zero], scale: [one, one, one], enabled: one });
bucket.connector({ target: 'rope', from: [zero, zero, zero], to: [zero, drop, zero], scale: [one, finalScale, one], enabled: one, aim: [0, 1, 0] });

/** The shipping frame-delta ramp; oil is copied only at boot, and these scalars own no interaction authority. */
const prompt = new ClientChannels('sunscar.well.prompt');
for (const axis of ['x', 'y', 'z'] as const) prompt.output(axis, prompt.read(`well.${axis}`));
prompt.prompt({ id: 'sunscar.well.prompt', label: STRINGS.wellDown, radius: 2.6, at: [0, -1e5, 0], action: { kind: 'named', name: 'sunscar.well.take' } });
export const SIGNAL_BUCKET_CHANNELS = [bucket.build(), prompt.build()];

import { lowerMoverMotion } from '@wildshard/format/moverMotion';
import { parseMovers } from '@wildshard/format/movers';
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { FLAG } from '../data/flags';
import STRINGS from '../data/strings.json' with { type: 'json' };
import scenes from '../data/restScenes.generated.json' with { type: 'json' };

const id = 'sunscar.well.bucket', drop = scenes.bindings.well.fields.drop.value;
const at = { x: 0, y: 1.85 - drop, z: 0 }, euler = { x: 0, y: 0, z: 0 };
const motion = { driver: { kind: 'track' }, trigger: { kind: 'interact', permission: 0 },
  track: { clip: 'haul', duration: 1.2, loop: 'once', speed: 1, times: [0, 1.2], position: [[0, at.y, 0], [0, 1.35, 0]] } };
/** The existing native track owns progress; saved oil restores its endpoint silently, without a physics body. */
export const SIGNAL_BUCKET_MOVERS = parseMovers([{ id, entity: 8010, kind: 'channel', execution: 'native', at, euler,
  enabled: true, boxes: [], ...lowerMoverMotion(motion, { at, euler }), ...motion,
  atEnd: { field: 5, equals: 1 }, restoreFrom: { flag: FLAG.oil, action: 'end' } }]);

const bucket = new ClientChannels(id); bucket.fromMover(id);
const zero = bucket.constant(0), one = bucket.constant(1), height = bucket.read('position.y');
const scale = bucket.binary('sub', one, bucket.binary('mul', bucket.read('field.5'), bucket.constant(0.8)));
bucket.output('y', height); bucket.output('scaleY', scale);
bucket.connector({ target: 'bucket', from: [zero, height, zero], to: [zero, height, zero], scale: [one, one, one], enabled: one });
bucket.connector({ target: 'rope', from: [zero, zero, zero], to: [zero, bucket.constant(drop), zero], scale: [one, scale, one], enabled: one,
  aim: [0, 1, 0], instances: { start: 0, capacity: 1 } });

const prompt = new ClientChannels('sunscar.well.prompt');
for (const axis of ['x', 'y', 'z'] as const) prompt.output(axis, prompt.read(`well.${axis}`));
prompt.prompt({ id: 'sunscar.well.prompt', label: STRINGS.wellDown, radius: 2.6, at: [0, -1e5, 0], action: { kind: 'named', name: 'sunscar.well.take' } });
/** Read-only projections of the admitted bucket pose and the original jar prompt. */
export const SIGNAL_BUCKET_CHANNELS = [bucket.build(), prompt.build()];

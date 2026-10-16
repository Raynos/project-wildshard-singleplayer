import * as v from 'valibot';
import { MoverTransitSchema } from '@wildshard/format/moverMotion';
import { ISLET, POND } from '../data/layout';
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };

const site = timbers.landmarks.canoe[0];
if (site === undefined) throw new Error('Missing authored canoe site');
/** Bank endpoints carry the water minimum; page admission retains live terrain/registry floor sampling. */
export const PINE_CANOE = v.parse(MoverTransitSchema, {
  kind: 'transit', from: [site.x - 1.2, POND.level, site.z], to: [ISLET.x + ISLET.r - 1.6, POND.level, ISLET.z + 0.4],
  landings: [[site.x + 2.6, 0, site.z + 1.4], [ISLET.x + ISLET.r - 3.8, 0, ISLET.z + 0.6]],
  seconds: 9, water: POND.level + 0.02, bankRamp: 8, seat: -0.45, yaw: Math.PI,
  bob: [1.9, 0.03], pitch: [1.3, 0.02], roll: [2.1, 0.035, 1],
});

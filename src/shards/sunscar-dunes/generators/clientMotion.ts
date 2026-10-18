import { parseSceneMotion } from '@wildshard/format/sceneMotion';
import { SIGNAL_BUCKET_CHANNELS } from './bucket';
import motion from '../data/nativeMotion.json' with { type: 'json' };

/** Native bucket motion and the original jar point; prompt identity is retained. */
export const SIGNAL_SCENE_MOTION = parseSceneMotion({ version: 1, owner: 'native', installation: motion, groups: [
  { id: 'native', programs: SIGNAL_BUCKET_CHANNELS.map(row => row.id), nativeOwners: ['sunscar.well.bucket'],
    targets: { bucket: 'well.bucket', rope: 'well.rope' },
    initial: [{ program: 'sunscar.well.prompt', at: { point: 'well.jar-at' } }],
    prompts: [{ id: 'sunscar.well.prompt', action: 'well' }] },
] });

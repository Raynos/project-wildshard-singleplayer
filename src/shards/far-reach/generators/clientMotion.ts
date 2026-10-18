import { parseSceneMotion } from '@wildshard/format/sceneMotion';
import { SKY_MOVER_VIEWS } from './rows/moverViews';
import { SKY_LIFT_PROMPTS } from './rows/liftPrompts';
import { SKY_NATIVE_WORLD } from './rows/nativeWorld';
import islets from '../data/isletScenes.generated.json' with { type: 'json' };
import { SKY_DRESSING_FRAMES } from './sceneDressing';

const copied = SKY_MOVER_VIEWS.filter(row => row.connectors !== undefined);
const targets = [...new Set(copied.flatMap(row => [
  ...row.bindings?.map(binding => binding.target) ?? [], ...row.connectors?.map(binding => binding.target) ?? [],
]))];
const motion = SKY_NATIVE_WORLD.motion;
/** The same copied islet poses, native bridge owners and ordered lift prompts. */
export const SKY_SCENE_MOTION = parseSceneMotion({ version: 1, owner: 'native',
  installation: { systemId: motion.systemId, viewSystemId: motion.viewSystemId,
    socketLiftPrompts: motion.socketLiftPrompts, permissions: motion.permissions, frameSystemId: 'far.dressing' },
  frames: SKY_DRESSING_FRAMES,
  groups: [
    { id: 'islets', programs: copied.map(row => row.id), copiedOwners: islets.rest.map(row => row.id),
      targets: Object.fromEntries(targets.map(id => [id, `moving-islets.${id}`])), rest: islets.rest },
    { id: 'native', programs: [...SKY_MOVER_VIEWS.filter(row => row.connectors === undefined), ...SKY_LIFT_PROMPTS].map(row => row.id),
      targets: { winch: 'frames.fallen' }, nativeOwners: motion.nativeOwners, bindings: ['islets'],
      observations: [{ program: 'far.winch.view', channel: 'value', value: 'frames.winch-up' }] },
  ],
});

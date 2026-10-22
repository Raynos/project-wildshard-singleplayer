import scene from '../data/ironSwordScene.json' with { type: 'json' };
import steps from '../data/questSteps.json' with { type: 'json' };
import * as v from 'valibot';
import { HeldArmsSchema } from '@wildshard/format/heldArms';
import authored from '../data/heldArms.json' with { type: 'json' };
import wreck from '../data/wreckBake.json' with { type: 'json' };
import { DRIFTWOOD_FIXED_SOURCES } from './assets';

/** Bake the existing rack anchor and asset identities; runtime claims need no world-object callbacks. */
export const HELD_ARMS = v.parse(HeldArmsSchema.options[0], { ...authored, claims: authored.claims.map(({ site, ...claim }) => {
  const anchor: unknown = Reflect.get(wreck.anchors, site.anchor);
  if (typeof anchor !== 'object' || anchor === null || !('x' in anchor) || !('y' in anchor) || !('z' in anchor) || !('yaw' in anchor)
    || typeof anchor.x !== 'number' || typeof anchor.y !== 'number' || typeof anchor.z !== 'number' || typeof anchor.yaw !== 'number')
    throw new Error('Held claim requires its baked anchor');
  const condition = steps.guards.find(row => row.id === claim.guard.id);
  if (condition === undefined) throw new Error('Held claim requires its quest guard row');
  return Object.assign(claim, { scene, guard: { condition, radius: claim.guard.radius, toast: claim.guard.toast }, position: [anchor.x + Math.sin(anchor.yaw) * site.reach, anchor.y, anchor.z + Math.cos(anchor.yaw) * site.reach],
    geometries: Object.fromEntries(Object.entries(claim.geometries).map(([id, slot]) => {
      const file = DRIFTWOOD_FIXED_SOURCES[slot]; if (file === undefined) throw new Error('Held claim requires its declared geometry');
      return [id, file];
    })) });
}) });

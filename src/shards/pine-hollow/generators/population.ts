import collision from '../data/kingCollision.generated.json' with { type: 'json' };
import blend from '../data/kingBlend.json' with { type: 'json' };
import clips from '../data/kingClips.generated.json' with { type: 'json' };
import { parseNativePopulationRows } from '@wildshard/format/populationRoster';
import { PINE_FAUNA } from '../data/fauna.generated';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { PINE_ELITE_DEFS, PINE_ELITE_ANIMALS, ORDINARY } from './eliteRoster';

/** Native spawn/population rows; encounter behaviour remains with the existing elite and King owners. */
export const POPULATION_ROSTER = parseNativePopulationRows({
  limbPose: { step: 'pine.king.pose', limit: 512, near: 140, head: 'head', collision, blend, clips },
  version: 1, environment: 'pine.habitat', step: 'pine.roster', seed: 1368, bodyCount: 164, limit: 512,
  scripted: 'sidestep', encounter: 'antler-king', poseKinds: ['antler-king'],
  fauna: PINE_FAUNA, spawn: { x: LAYOUT.SPAWN.x, z: LAYOUT.SPAWN.z },
  identities: Object.values(PINE_ELITE_ANIMALS).map(({ kind, variant }) => ({ kind, variant })),
  ordinary: ORDINARY,
  reserves: [{ kind: 'antler-king', variant: null }, { kind: 'elk', variant: 'thrall' }, { kind: 'boar', variant: 'thrall' }],
  homes: Object.entries(PINE_ELITE_DEFS).map(([id, row]) => {
    const who = PINE_ELITE_ANIMALS[id];
    if (who === undefined) throw new Error('Missing elite roster identity');
    return { kind: who.kind, variant: who.variant, x: row.lair.x, z: row.lair.z, stream: `pine.elite.spawn.${id}` };
  }),
});

import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import inventory from '../data/fixedGeometry.json' with { type: 'json' };
import { DRIFTWOOD_FIXED_SOURCES } from './assets';
import authoredPoolLook from '../data/poolLook.json' with { type: 'json' };
import { CASCADE_LOOKS } from './waterfallLook';

const { POOL_LOOK } = authoredPoolLook;

/** Static cascade assembly; the geometry and its application channels remain the existing fixed bake. */
export const WORLD_SCENES: WorldScenesSection = {
  version: 1,
  libraries: [{ id: 'cascade', kind: 'owned', models: ['waterfallSheet', 'waterfallRings', 'waterfallPuffs', 'coveStructure', 'coveRocks', 'coveGlow', 'covePools'].map(id => {
    const row = inventory.draws.find(entry => entry.slot === id), file = id === 'covePools' ? 'models/scene-pools.glb' : id === 'waterfallRings' ? 'models/scene-rings.glb' : DRIFTWOOD_FIXED_SOURCES[id];
    if (row === undefined || file === undefined) throw new Error(`Missing cascade bake: ${id}`);
    const attributes: Record<string, string> = {};
    for (const [from, to] of row.channels) { if (from === undefined || to === undefined) throw new Error('Missing cascade channel'); attributes[from] = to; }
    return { id, file, attributes };
  }) }],
  materials: [...Object.entries(CASCADE_LOOKS).map(([id, look]) => ({ id, kind: 'look' as const, look })),
    { id: 'still', kind: 'lowpoly', variant: 'still', properties: {} },
    { id: 'rock', kind: 'lowpoly', variant: 'rock-smooth', properties: { flatShading: false, roughness: 0.82 } },
    { id: 'glow', kind: 'basic', properties: { vertexColors: true } }, { id: 'pool-look', kind: 'look', look: POOL_LOOK },
  ],
  steps: [{ id: 'cascade', scene: 'scenes/cascade.json',
    geometry: { sheet: { library: 'cascade', model: 'waterfallSheet' }, rings: { library: 'cascade', model: 'waterfallRings' }, puffs: { library: 'cascade', model: 'waterfallPuffs' } },
    materials: { sheet: 'curtain', rings: 'pool', puffs: 'puffs' }, registry: [], publish: {}, instanceAttributes: [],
    bounds: [{ part: 'puffs', sphere: {"center": [126.2795181274414, 5.813096046447754, 19.283491134643555], "radius": 11.813198103364037} }],
  }, { id: 'cove', scene: 'scenes/cove.json',
    geometry: { structure: { library: 'cascade', model: 'coveStructure' }, rocks: { library: 'cascade', model: 'coveRocks' }, glow: { library: 'cascade', model: 'coveGlow' }, pools: { library: 'cascade', model: 'covePools' } },
    materials: { structure: 'still', rocks: 'rock', glow: 'glow', pools: 'pool-look' }, registry: [], bounds: [], instanceAttributes: [],
    publish: { rocks: { kind: 'object', part: 'rocks' } },
  }],
};

/** The original world index widths, normalized offline rather than expanded by the standalone GLB export. */
export const SCENE_MODEL_BLOBS = [
  { name: 'models/scene-pools.glb', kind: 'glb', source: 'assets/world-scenes/pools.glb' },
  { name: 'models/scene-rings.glb', kind: 'glb', source: 'assets/world-scenes/rings.glb' },
];

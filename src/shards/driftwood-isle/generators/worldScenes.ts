import piers from '../data/pierScenes.generated.json' with { type: 'json' };
import native from '../data/nativeSpecimens.generated.json' with { type: 'json' };
import cargo from '../data/cargoScenes.generated.json' with { type: 'json' };
import { REEF_SCENE_LIBRARY } from './reefCatalogue';
import foliage from '../data/foliageScenes.generated.json' with { type: 'json' };
import { REEF_LOOK } from './reefLook';
import rocks from '../data/rockScenes.generated.json' with { type: 'json' };
import trail from '../data/trailsideBake.json' with { type: 'json' };
import { parseWorldScenes, type WorldScenesSection } from '@wildshard/format/worldScenes';
import inventory from '../data/fixedGeometry.json' with { type: 'json' };
import zipBlobs from '../data/ziplineBlobs.generated.json' with { type: 'json' };
import { DRIFTWOOD_FIXED_SOURCES } from './assets';
import authoredPoolLook from '../data/poolLook.json' with { type: 'json' };
import { CASCADE_LOOKS } from './waterfallLook';
import { WORLD_PLACEMENTS } from './worldPlacements';

const { POOL_LOOK, SHRINE_POOL_LOOK } = authoredPoolLook;
const rockRows = parseWorldScenes({ version: 1, libraries: [rocks.section.library], materials: [], steps: [rocks.section.step] });
const cargoRows = parseWorldScenes({ version: 1, libraries: [cargo.library], materials: [], steps: [] });
const nativeRows = parseWorldScenes({ version: 1, libraries: [native.library], materials: [], steps: [] });

/** Static cascade assembly; the geometry and its application channels remain the existing fixed bake. */
export const WORLD_SCENES: WorldScenesSection = {
  version: 1, catalogue: 'models/world-scenes.json',
  libraries: [...cargoRows.libraries, ...nativeRows.libraries, REEF_SCENE_LIBRARY, ...rockRows.libraries, ...parseWorldScenes({ version: 1, libraries: foliage.libraries, materials: [], steps: [] }).libraries, { id: 'cascade', kind: 'owned', models: ['waterfallSheet', 'waterfallRings', 'waterfallPuffs', 'coveStructure', 'coveRocks', 'coveGlow', 'covePools', 'wreckKit', 'wreckGlow', 'wreckRocks', 'trailside', 'hutKit', 'hutFlames', 'lookout', 'shipwreckKit', 'shipwreckGlow', 'shrineKit', 'shrineWater', 'shrineGlyphs', 'shrineSpecimenKit', 'shrineSpecimenWater', 'shrineSpecimenGlyphs', ...piers.slots, 'boatHull', 'boatSail', 'boatGear', 'mooringLines', 'duneLogs', ...Object.values(inventory.groups.driftLogs)].map(id => {
    const row = inventory.draws.find(entry => entry.slot === id), file = id === 'covePools' ? 'models/scene-pools.glb' : id === 'waterfallRings' ? 'models/scene-rings.glb' : DRIFTWOOD_FIXED_SOURCES[id];
    if (row === undefined || file === undefined) throw new Error(`Missing cascade bake: ${id}`);
    const attributes: Record<string, string> = {};
    for (const [from, to] of row.channels) { if (from === undefined || to === undefined) throw new Error('Missing cascade channel'); attributes[from] = to; }
    return { id, file, attributes };
  }).concat(['world', 'trolley', 'specimen', 'parked'].map(key => { const name = `models/zipline/${key}.glb`, blob = zipBlobs.blobs.find(row => row.name === name); if (blob === undefined) throw new Error(`Missing zipline scene: ${key}`); return { id: `zipline-${key}`, file: name, attributes: {} }; })) }],
  placements: [...piers.placements.map(row => ({ id: row.id, file: `world/piers/${row.id}.json` })), { id: 'foliage.logs', file: 'world/foliage/logs.json' }, { id: 'wreck.logs', file: 'world/foliage/wreck-logs.json' }, ...WORLD_PLACEMENTS, ...['phone', 'desktop'].flatMap(tier => ['palms', 'hibiscus'].map(kind => ({ id: `foliage.${kind === 'palms' ? 'palms' : 'bushes'}.${tier}`, file: `world/foliage/${kind}-${tier}.json` })))],
  materials: [{ id: 'solid', kind: 'lowpoly', variant: 'solid', properties: {} }, { id: 'pennant', kind: 'lowpoly', variant: 'pennant', properties: {} }, { id: 'palm', kind: 'lowpoly', variant: 'palm', properties: {} }, { id: 'reef', kind: 'look', look: REEF_LOOK }, ...Object.entries(CASCADE_LOOKS).map(([id, look]) => ({ id, kind: 'look' as const, look })),
    { id: 'shrine-pool', kind: 'look', look: SHRINE_POOL_LOOK },
    { id: 'glyphs', kind: 'basic', properties: { color: 0x7fd9ff, side: 2 } },
    { id: 'kit', kind: 'lowpoly', variant: 'default', properties: {} },
    { id: 'still', kind: 'lowpoly', variant: 'still', properties: {} },
    { id: 'rock', kind: 'lowpoly', variant: 'rock-smooth', properties: { flatShading: false, roughness: 0.82 } },
    { id: 'glow', kind: 'basic', properties: { vertexColors: true } }, { id: 'pool-look', kind: 'look', look: POOL_LOOK },
  ],
  steps: [...rockRows.steps, { id: 'zipline', scene: 'scenes/zipline.json', geometry: { rig: { library: 'cascade', model: 'zipline-world' }, trolley: { library: 'cascade', model: 'zipline-trolley' } }, materials: { still: 'still' }, registry: [], publish: { anchor: { kind: 'vector', value: [piers.zipBindings.anchor[0] ?? 0, 0, piers.zipBindings.anchor[1] ?? 0] }, carriage: { kind: 'object', part: 'trolley' }, a: { kind: 'vector', value: piers.zipBindings.a as [number, number, number] }, b: { kind: 'vector', value: piers.zipBindings.b as [number, number, number] }, prompt: { kind: 'vector', value: piers.zipBindings.prompt as [number, number, number] } }, bounds: [], instanceAttributes: [] }, { id: 'moorings', scene: 'scenes/moorings.json', geometry: { lines: { library: 'cascade', model: 'mooringLines' } }, materials: { still: 'still' }, registry: [], publish: { mesh: { kind: 'object', part: 'lines' } }, bounds: [], instanceAttributes: [] }, ...['palms', 'hibiscus', 'reef', 'logs'].map(kind => ({ id: kind, scene: `scenes/${kind}.json`, geometry: { plant: { library: kind === 'logs' ? 'cascade' : 'foliage', model: kind === 'logs' ? 'duneLogs' : kind } }, materials: { plant: kind === 'palms' ? 'palm' : kind === 'reef' ? 'reef' : 'kit' }, registry: [], publish: { mesh: { kind: 'object' as const, part: 'mesh' } }, bounds: [], instanceAttributes: [] })), { id: 'cascade', scene: 'scenes/cascade.json',
    geometry: { sheet: { library: 'cascade', model: 'waterfallSheet' }, rings: { library: 'cascade', model: 'waterfallRings' }, puffs: { library: 'cascade', model: 'waterfallPuffs' } },
    materials: { sheet: 'curtain', rings: 'pool', puffs: 'puffs' }, registry: [], publish: {}, instanceAttributes: [],
    bounds: [{ part: 'puffs', sphere: {"center": [126.2795181274414, 5.813096046447754, 19.283491134643555], "radius": 11.813198103364037} }],
  }, { id: 'cove', scene: 'scenes/cove.json',
    geometry: { structure: { library: 'cascade', model: 'coveStructure' }, rocks: { library: 'cascade', model: 'coveRocks' }, glow: { library: 'cascade', model: 'coveGlow' }, pools: { library: 'cascade', model: 'covePools' } },
    materials: { structure: 'still', rocks: 'rock', glow: 'glow', pools: 'pool-look' }, registry: [], bounds: [], instanceAttributes: [],
    publish: { rocks: { kind: 'object', part: 'rocks' } },
  }, { id: 'wreck', scene: 'scenes/wreck.json',
    geometry: { kit: { library: 'cascade', model: 'wreckKit' }, glow: { library: 'cascade', model: 'wreckGlow' }, rocks: { library: 'cascade', model: 'wreckRocks' } },
    materials: { kit: 'kit', glow: 'glow', rock: 'rock' }, registry: [], bounds: [], instanceAttributes: [], publish: {},
  }, { id: 'trail', scene: 'scenes/trail.json', geometry: { trail: { library: 'cascade', model: 'trailside' } },
    materials: { kit: 'still' }, registry: parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [{ id: 'trail', scene: 'scenes/trail.json', registry: [{ id: 'trailside', name: 'Trailside', category: 'props', file: 'data/trailScene.json', part: 'trail', colliders: trail.worldColliders, surface: 'wood', solidFloor: true }] }] }).steps.flatMap(step => step.registry), bounds: [], instanceAttributes: [], publish: { mesh: { kind: 'object', part: 'trail' } },
  }],
};

/** The original world index widths, normalized offline rather than expanded by the standalone GLB export. */
export const SCENE_MODEL_BLOBS = [...rocks.blobs, ...foliage.blobs,
  { name: 'models/scene-pools.glb', kind: 'glb', source: 'assets/world-scenes/pools.glb' },
  { name: 'models/scene-rings.glb', kind: 'glb', source: 'assets/world-scenes/rings.glb' },
];

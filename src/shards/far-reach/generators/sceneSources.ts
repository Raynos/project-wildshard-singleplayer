import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { QUEST_NPC } from './questNpc';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { SceneModelSource, SceneBakeSource } from '@wildshard/game/shardfile/sceneSources';
import * as files from './fileInventory';
import { SKY_AO_FLOOR } from './modelFrames';
import { ISLET_POOL } from './restFiles';
import heroes from '../data/heroLibrary.generated.json' with { type: 'json' };
import rest from '../data/restPools.generated.json' with { type: 'json' };
import bridges from '../data/bridgeRest.generated.json' with { type: 'json' };
import mill from '../data/millRest.generated.json' with { type: 'json' };
import world from '../data/worldRows.generated.json' with { type: 'json' };
import fixed from '../data/staticScenes.generated.json' with { type: 'json' };
import type { WorldPieceRow } from '@wildshard/game/shardfile/bakedKinds';
import { SKY_RIG_LIBRARY, SKY_MODEL_SPECIMENS } from './rigLibrary';
import { GEAR_SCENE_ROWS } from './rows/gearModels';
import { FAN_HELD_RECIPE } from './rows/heldWeapon';

const { resources: _resources, attachments: _attachments, ...fanRecipe } = FAN_HELD_RECIPE;
const { specimen: _fan, ...fan } = GEAR_SCENE_ROWS[0];
const { specimen: keeperSource, ...keeper } = GEAR_SCENE_ROWS[3];

/** The original library definitions, shared by native view and declared scenes. */
const sky = { rows: { meshes: files.SKY_MESHES, preparedMeshes: files.SKY_MESHES, meshUrls: files.MODEL_URLS,
  hd: [], hdUrls: {}, hdLooks: {}, aoFloor: SKY_AO_FLOOR, geometryPools: [files.FAN_POOL, ...rest, bridges.pool, ISLET_POOL, mill],
  rigs: SKY_RIG_LIBRARY, rigLoad: 'manual', mappedFallback: { roughness: 0.85, metalness: 0 } }, specimens: SKY_MODEL_SPECIMENS,
  held: [{ item: FAN_HELD_RECIPE.equipment.id, definition: fan, recipe: fanRecipe, resources: { geometry: FAN_HELD_RECIPE.resources.geometry.map(row => ({ id: row.id, source: { library: 'sky', model: row.args[0] } })) },
    attachments: FAN_HELD_RECIPE.attachments.map(row => ({ id: row.id, row: parsePrivateScene(row.row), parent: row.parent, resources: {
      geometry: row.resources.geometry.map(geometry => ({ id: geometry.id, source: { library: 'sky', model: geometry.args[0] } })),
      textures: [{ id: 'hand', source: { library: 'heroes', model: 'hand-hd' } }],
    } })) }],
  scenes: [{ part: 'specimen-mill.root', step: 'specimen-mill', materialLibrary: 'sky', definition: GEAR_SCENE_ROWS[1] }, { part: 'specimen-bridge.root', step: 'specimen-bridge', materialLibrary: 'sky', definition: GEAR_SCENE_ROWS[2] }, { part: 'specimen-vane.root', step: 'specimen-vane', materialLibrary: 'sky', definition: GEAR_SCENE_ROWS[4] }],
  npcs: [{ npc: keeperSource.npc, definition: keeper, model: { kind: 'pivots', id: QUEST_NPC.npc.figure.model, material: keeperSource.figure.materialId }, library: 'heroes', materialLibrary: 'sky' }],
} satisfies SceneModelSource;
const hero = { rows: { meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: SKY_AO_FLOOR,
  geometryPools: [heroes.pool], paintedModels: heroes.models } } satisfies SceneModelSource;
const bakeRows = Object.fromEntries(Object.entries(world.bakes).map(([id, row]) => [id, { ...row, kinds: row.kinds.map(kind => ({ ...kind, ...('paint' in kind ? { look: 'isle-paint' } : {}) })) }]));
const baked = { rows: bakeRows, urls: files.BAKED_URLS,
  placements: { rows: world.pieces as readonly WorldPieceRow[], colliders: fixed.standalone.fixed.colliders },
  materialLibrary: 'sky', attributes: { _shk: 'aShk', _farcloth: 'aFarCloth' } } satisfies SceneBakeSource;
const json = (name: string, rows: unknown) => nameBlob(name, 'json', new TextEncoder().encode(JSON.stringify(rows)));
export const SKY_SOURCE_BLOBS = [json('world/sources/sky.json', sky), json('world/sources/heroes.json', hero), json('world/sources/bakes.json', baked)];
export const SKY_SOURCE_LIBRARIES = [{ id: 'sky', kind: 'models', file: 'world/sources/sky.json' },
  { id: 'heroes', kind: 'models', file: 'world/sources/heroes.json' }, { id: 'bakes', kind: 'baked', file: 'world/sources/bakes.json' }] as const;

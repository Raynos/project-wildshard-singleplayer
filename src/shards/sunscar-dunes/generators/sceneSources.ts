import * as v from 'valibot';
import { SceneDrawsSchema } from '@wildshard/format/sceneDraws';
import { FIRE_GRAPH_IDS } from './rows/fire';
import { signalEmberBuffer } from './emberBuffers';
import restScenes from '../data/restScenes.generated.json' with { type: 'json' };
import { QUEST_NPC } from './questNpc';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { SceneModelSource, SceneBakeSource } from '@wildshard/game/shardfile/sceneSources';
import models from '../assets/models.generated.json' with { type: 'json' };
import rest from '../data/restPools.generated.json' with { type: 'json' };
import pieces from '../assets/pieces.generated.json' with { type: 'json' };
import world from '../data/worldBakes.generated.json' with { type: 'json' };
import surfaces from '../assets/surfaces.generated.json' with { type: 'json' };
import { SIGNAL_RIG_LIBRARY, SIGNAL_MODEL_SPECIMENS } from './rows/rigLibrary';
import { GEAR_SCENE_ROWS } from './rows/gearModels';
import { WHIP_HELD_RECIPE } from './rows/heldWeapon';
import { HD_GLOVE_SIZE } from './rows/whip';

const { resources: _resources, ...whipRecipe } = WHIP_HELD_RECIPE;
const { specimen: _whip, ...whip } = GEAR_SCENE_ROWS[0];
const { specimen: scoutSource, ...scout } = GEAR_SCENE_ROWS[5];
function effects(source: typeof restScenes.bindings.tower | typeof restScenes.bindings.caravan | typeof restScenes.bindings.well | (typeof restScenes.bindings.braziers)[number] | undefined) {
  if (source === undefined) throw new Error('Missing original specimen place');
  return [...source.lamps, ...source.fires].map(effect => {
    const draws: unknown[] = [];
    const cards = (group: { readonly name: string; readonly order: number; readonly cards: readonly { readonly program: string; readonly quad: string; readonly scale: unknown; readonly at?: readonly number[]; readonly order?: number }[] }): void => {
      for (const card of group.cards) { const material = new Map(Object.entries(FIRE_GRAPH_IDS)).get(card.program); if (material === undefined) throw new Error('Missing effect material');
        draws.push({ kind: 'card', material, geometry: { library: 'models', model: `fire-${card.quad}` }, name: group.name, order: card.order ?? group.order, scale: card.scale, at: card.at ?? [0, 0, 0] }); }
    };
    if ('fire' in effect.rows) { cards(effect.rows.fire); const ember = effect.rows.embers;
      draws.push({ kind: 'buffered', material: FIRE_GRAPH_IDS.embers, file: signalEmberBuffer(ember.count, ember.name), scale: ember.scale, y: ember.y }); cards(effect.rows.smoke);
    } else cards(effect.rows.halo);
    if (effect.pool !== null) draws.push({ kind: 'pool', material: FIRE_GRAPH_IDS.pool, geometry: { library: 'models', model: effect.pool } });
    return { part: effect.part, draws: v.parse(SceneDrawsSchema, draws) };
  });
}
const inputs = { dusk: 'dusk', lights: 'firelights' };
/** Original models and material decorations; no rendering builder is mirrored. */
const library = { rows: { ...models.DUNE_MODELS, geometryPools: rest, rigs: SIGNAL_RIG_LIBRARY }, inputs, specimens: SIGNAL_MODEL_SPECIMENS,
  held: [{ item: WHIP_HELD_RECIPE.equipment.id, definition: whip, recipe: whipRecipe, resources: {
    geometry: ['coil', 'loop', 'cord', 'wrap'].map(id => ({ id, source: { library: 'bakes', model: id }, piece: 'lash', index: 'array' as const })),
    objects: [{ id: 'hero', source: { library: 'models', model: 'glove-hd4' }, fit: { size: HD_GLOVE_SIZE, by: 'span' } }],
    textures: [{ id: 'plait', source: { library: 'bakes', model: 'plait' }, resource: 'plait', bytes: 196608 }],
    decorators: [{ id: 'plait', rows: surfaces.COIL_SURFACE }], repeats: WHIP_HELD_RECIPE.resources.repeats,
  } }],
  scenes: [{ part: 'tower.root', step: 'tower', materialLibrary: 'models', effects: effects(restScenes.bindings.tower), definition: GEAR_SCENE_ROWS[1] }, { part: 'caravan.root', step: 'caravan', materialLibrary: 'models', effects: effects(restScenes.bindings.caravan), definition: GEAR_SCENE_ROWS[2] }, { part: 'well.root', step: 'well', materialLibrary: 'models', effects: effects(restScenes.bindings.well), definition: GEAR_SCENE_ROWS[3] }, { part: 'brazier.0.root', step: 'brazier.0', materialLibrary: 'models', effects: effects(restScenes.bindings.braziers[0]), definition: GEAR_SCENE_ROWS[4] }],
  npcs: [{ npc: scoutSource.npc, definition: scout, model: { kind: 'mesh', id: QUEST_NPC.npc.figure.model }, library: 'models' }],
} satisfies SceneModelSource;
const rows = Object.fromEntries(Object.entries(world).map(([id, row]) => [id, { ...row, kinds: row.kinds.map(kind => ({ ...kind,
  ...('warm' in kind && kind.warm ? { surface: surfaces.CAMP_SURFACE } : {}) })) }]));
const baked = { rows, urls: models.BAKED_URLS, inputs, resources: models.WORLD_BYTES,
  placements: { rows: pieces, colliders: world.braziers.braziers.map((row, index) => ({ id: `sunscar.brazier.${String(index)}`, colliders: row.colliders })) } } satisfies SceneBakeSource;
const json = (name: string, value: unknown) => nameBlob(name, 'json', new TextEncoder().encode(JSON.stringify(value)));
export const SIGNAL_SOURCE_BLOBS = [json('world/sources/models.json', library), json('world/sources/bakes.json', baked)];
export const SIGNAL_SOURCE_LIBRARIES = [{ id: 'models', kind: 'models', file: 'world/sources/models.json' },
  { id: 'bakes', kind: 'baked', file: 'world/sources/bakes.json' }] as const;

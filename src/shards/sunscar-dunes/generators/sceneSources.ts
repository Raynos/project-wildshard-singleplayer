import * as v from 'valibot';
import { SceneDrawsSchema } from '@wildshard/format/sceneDraws';
import { FIRE_GRAPH_IDS } from './rows/fire';
import { signalEmberBuffer } from './emberBuffers';
import { placeEffects, type PlaceEffects } from './placeEffects';
import type { CardGroupRow } from './rows/fireCards';
import { QUEST_NPC } from './questNpc';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { SceneModelSource, SceneBakeSource } from '@wildshard/game/shardfile/sceneSources';
import * as models from './rows/files';
import rest from '../data/restPools.generated.json' with { type: 'json' };
import { SIGNAL_PIECES as pieces } from './rows/pieces';
import * as surfaces from './rows/surfaces';
import { SIGNAL_MODEL_SPECIMENS } from './rows/rigLibrary';
import { gearSceneRows } from './rows/gearModels';
import { whipHeldRecipe } from './rows/heldWeapon';
import { HD_GLOVE_SIZE } from './rows/whip';

type ScenePiece = SceneBakeSource['rows'][string] & { readonly glb: string };
/** Existing bake rows and the original specimen anchors; both published and owned inputs share this shape. */
export type SceneWorldBakes = Readonly<Record<'rocks' | 'dressing' | 'tower' | 'caravan' | 'well' | 'lash' | 'braziers', ScenePiece>> & {
  readonly caravan: { readonly anchors: { readonly y: number } }; readonly well: { readonly anchors: { readonly y: number } };
  readonly lash: { readonly tip: readonly number[]; readonly along: number };
  readonly braziers: { readonly braziers: readonly { readonly y: number; readonly colliders: ScenePiece['colliders'] }[] };
};
function effects(source: PlaceEffects | undefined) {
  if (source === undefined) throw new Error('Missing original specimen place');
  return [...source.lamps, ...source.fires].map(effect => {
    const draws: unknown[] = [];
    const cards = (group: CardGroupRow): void => {
      for (const card of group.cards) {
        if (card.quad === undefined || card.scale === undefined) throw new Error('Missing original specimen fire card shape');
        const material = new Map(Object.entries(FIRE_GRAPH_IDS)).get(card.program); if (material === undefined) throw new Error('Missing effect material');
        draws.push({ kind: 'card', material, geometry: { library: 'models', model: `fire-${card.quad}` }, name: group.name, order: card.order ?? group.order, scale: card.scale, at: card.at ?? [0, 0, 0] }); }
    };
    if ('fire' in effect.rows) { cards(effect.rows.fire); const ember = effect.rows.embers;
      draws.push({ kind: 'buffered', material: FIRE_GRAPH_IDS.embers, file: signalEmberBuffer(ember.count, ember.name), scale: ember.scale, y: ember.y }); cards(effect.rows.smoke);
    } else cards(effect.rows.halo);
    if (effect.pool !== null) draws.push({ kind: 'pool', material: FIRE_GRAPH_IDS.pool, geometry: { library: 'models', model: effect.pool } });
    return { part: effect.part, draws: v.parse(SceneDrawsSchema, draws) };
  });
}
const bindings = placeEffects();
const inputs = { dusk: 'dusk', lights: 'firelights' };
const publicFiles = { urls: models.BAKED_URLS, resources: models.WORLD_BYTES };
const json = (name: string, value: unknown) => nameBlob(name, 'json', new TextEncoder().encode(JSON.stringify(value)));
/** Original models, material decorations and bakes from explicit world rows; no rendering builder is mirrored. */
export function signalSceneSources(world: SceneWorldBakes, rigs: NonNullable<SceneModelSource['rows']['rigs']>, files: { readonly urls: SceneBakeSource['urls']; readonly resources: NonNullable<SceneBakeSource['resources']> } = publicFiles, ownedPools: ReadonlyMap<string, NonNullable<SceneModelSource['rows']['geometryPools']>[number]> = new Map()): NamedBlob[] {
  for (const url of ownedPools.keys()) if (rest.filter(pool => pool.url === url).length !== 1) throw new Error('Missing original rest pool binding');
  const pools = rest.map(pool => ownedPools.get(pool.url) ?? pool);
  const held = whipHeldRecipe(world.lash), gear = gearSceneRows(world, held);
  const { resources: _resources, ...whipRecipe } = held;
  const { specimen: _whip, ...whip } = gear[0];
  const { specimen: scoutSource, ...scout } = gear[5];
  const library = { rows: { ...models.DUNE_MODELS, geometryPools: pools, rigs }, inputs, specimens: SIGNAL_MODEL_SPECIMENS,
    held: [{ item: held.equipment.id, definition: whip, recipe: whipRecipe, resources: {
      geometry: ['coil', 'loop', 'cord', 'wrap'].map(id => ({ id, source: { library: 'bakes', model: id }, piece: 'lash', index: 'array' as const })),
      objects: [{ id: 'hero', source: { library: 'models', model: 'glove-hd4' }, fit: { size: HD_GLOVE_SIZE, by: 'span' } }],
      textures: [{ id: 'plait', source: { library: 'bakes', model: 'plait' }, resource: 'plait', bytes: 196608 }],
      decorators: [{ id: 'plait', rows: surfaces.COIL_SURFACE }], repeats: held.resources.repeats,
    } }],
    scenes: [{ part: 'tower.root', step: 'tower', materialLibrary: 'models', effects: effects(bindings.tower), definition: gear[1] }, { part: 'caravan.root', step: 'caravan', materialLibrary: 'models', effects: effects(bindings.caravan), definition: gear[2] }, { part: 'well.root', step: 'well', materialLibrary: 'models', effects: effects(bindings.well), definition: gear[3] }, { part: 'brazier.0.root', step: 'brazier.0', materialLibrary: 'models', effects: effects(bindings.braziers[0]), definition: gear[4] }],
    npcs: [{ npc: scoutSource.npc, definition: scout, model: { kind: 'mesh', id: QUEST_NPC.npc.figure.model }, library: 'models' }],
  } satisfies SceneModelSource;
  const rows = Object.fromEntries(Object.entries(world).map(([id, row]) => [id, { ...row, kinds: row.kinds.map(kind => ({ ...kind,
    ...('warm' in kind && kind.warm === true ? { surface: surfaces.CAMP_SURFACE } : {}) })) }]));
  const baked = { rows, urls: files.urls, inputs, resources: files.resources,
    placements: { rows: pieces, colliders: world.braziers.braziers.map((row, index) => ({ id: `sunscar.brazier.${String(index)}`, colliders: row.colliders })) } } satisfies SceneBakeSource;
  return [json('world/sources/models.json', library), json('world/sources/bakes.json', baked)];
}
export const SIGNAL_SOURCE_LIBRARIES = [{ id: 'models', kind: 'models', file: 'world/sources/models.json' },
  { id: 'bakes', kind: 'baked', file: 'world/sources/bakes.json' }] as const;

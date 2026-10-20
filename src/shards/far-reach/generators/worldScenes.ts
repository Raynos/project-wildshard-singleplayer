import { parseWorldScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { nameBlob } from '@wildshard/sdk/blobs';
import routes from '../data/routeScene.generated.json' with { type: 'json' };
import fixed from '../data/staticScenes.generated.json' with { type: 'json' };
import islets from '../data/isletScenes.generated.json' with { type: 'json' };
import heroes from '../data/heroLibrary.generated.json' with { type: 'json' };
import mill from '../data/millScene.generated.json' with { type: 'json' };
import world from '../data/worldRows.generated.json' with { type: 'json' };
import { SKY_SOURCE_LIBRARIES, SKY_SOURCE_BLOBS } from './sceneSources';
import STRINGS from '../data/strings.json' with { type: 'json' };
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import ground from '../data/groundScene.generated.json' with { type: 'json' };
import rest from '../data/restScenes.generated.json' with { type: 'json' };
import { SKY_ISLAND_BLOBS, SKY_ISLAND_LIBRARY, SKY_ISLE_TILES } from './islandScenes';
import { SKY_MEADOW_BLOB, SKY_MEADOW_FILE } from './meadowScene';

interface Reference { readonly library: string; readonly model: string }
const json = (name: string, value: unknown) => nameBlob(name, 'json', new TextEncoder().encode(JSON.stringify(value)));
export const SKY_SCENE_BLOBS = [...SKY_SOURCE_BLOBS, ...SKY_ISLAND_BLOBS, SKY_MEADOW_BLOB];
const steps: unknown[] = [], materials = new Map<string, unknown>();
const geometry = (name: string): Reference => SKY_ISLE_TILES.models.some(row => row.id === name) ? { library: 'isle-tiles', model: name }
  : SKY_ISLAND_LIBRARY.models.some(row => row.id === name) ? { library: 'islands', model: name }
  : name.startsWith('hero-') ? { library: 'heroes', model: name }
  : name === 'post-hd' ? { library: 'heroes', model: `hero-${name}` }
  : heroes.pool.parts.includes(name) ? { library: 'heroes', model: name } : { library: 'sky', model: name };
function material(source: string): string {
  if (materials.has(source)) return source;
  const [look, model] = source.split(':');
  if (look === undefined) throw new Error('Missing scene material identity');
  const row = source === 'halo' ? { id: source, kind: 'basic', properties: fixed.standalone.fixed.halo }
    : source === 'posts' ? { id: source, kind: 'look', look: 'post-weather', over: { library: 'heroes', model: 'post-hd' } }
    : { id: source, kind: 'look', look: source === 'deck' ? 'deck-wood' : source === 'frame' ? 'hover-frame' : look,
      ...(model === undefined ? {} : { over: { library: 'heroes', model } }) };
  materials.set(source, row); return source;
}
function scene(id: string, input: unknown, extra: Readonly<Record<string, unknown>> = {}): WorldSceneRecipe {
  const recipe = parseWorldScene(input), file = `world/scenes/${id}.json`;
  for (const node of recipe.scene.nodes) if (node.kind === 'object' || node.kind === 'anchor') node.missing = 'refuse';
  const ports = Object.fromEntries(recipe.scene.materials.flatMap(row => row.kind === 'port' ? [[row.source, material(row.source)]] : []));
  const textures = Object.fromEntries(recipe.scene.textures.map(row => {
    if (row.kind !== 'port') throw new Error('Unaccounted scene texture');
    return [row.source, { library: 'heroes', model: row.source === 'ready' ? 'mill-tower' : row.source }];
  }));
  SKY_SCENE_BLOBS.push(json(file, recipe));
  steps.push({ id, scene: file,
    geometry: Object.fromEntries(recipe.scene.nodes.flatMap(row => row.kind === 'mesh' ? [[row.geometry, geometry(row.geometry)]] : [])),
    baked: Object.fromEntries(recipe.imports.flatMap(row => row.kind === 'baked' ? [[row.piece, { library: 'bakes', model: row.piece }]] : [])),
    models: Object.fromEntries(recipe.imports.flatMap(row => row.kind === 'model' ? [[row.model, { library: 'heroes', model: row.model }]] : [])),
    materials: ports, textures, ...extra });
  return recipe;
}
const contact = (piece: string, baked?: string, cube: 'standalone' | 'cell' = 'standalone') => {
  const row = baked === undefined ? fixed[cube].fixed.colliders.find(entry => entry.id === piece) : Object.entries(world.bakes).find(([key]) => key === baked)?.[1];
  if (row === undefined) throw new Error(`Missing original contacts ${piece}/${baked ?? ''}`); return row.colliders;
};
const registration = (piece: string, part: string, colliders: readonly unknown[]) => {
  const row = world.pieces.find(value => value.id === piece);
  if (row === undefined) throw new Error(`Missing original scene piece ${piece}`);
  return { id: row.id, name: row.name, file: row.file, category: row.category, ...(row.surface === undefined ? {} : { surface: row.surface }), part, colliders, ...('mode' in row ? { mode: row.mode } : {}) };
};
scene('ground', ground.SKY_GROUND.recipe, {
  registry: ground.SKY_GROUND.bindings.map(row => registration(row.piece, row.part, contact(row.piece))),
});
for (const cube of ['standalone', 'cell'] as const) {
  const row = fixed[cube];
  // Native scene bindings omit colliders for visual-only groups; baked imports
  // and explicitly declared contact rows retain the original arrays.
  scene(`static-${cube}`, row.recipe, { cube,
    registry: row.bindings.map(binding => registration(binding.piece, binding.part,
      'baked' in binding ? contact(binding.piece, row.recipe.imports.find(entry => entry.id === binding.baked && entry.kind === 'baked')?.piece, cube) : fixed[cube].fixed.colliders.find(piece => piece.id === binding.piece)?.colliders ?? [])),
  });
}
scene('routes', { scene: routes.SKY_ROUTE_SCENE, imports: [] }, {
  publish: { glass: { kind: 'standard-material', part: 'glass' } },
  registry: routes.SKY_ROUTES.bindings.map(row => registration(row.piece, row.part, contact(row.piece))),
});
scene('posts', { scene: { version: 1, root: 'root', materials: [], nodes: [
  { id: 'root', kind: 'group', children: ['bake'] }, { id: 'bake', kind: 'object', source: 'bake', missing: 'refuse' },
] }, imports: [{ id: 'bake', kind: 'baked', piece: 'islet-rig' }] }, {
  registry: [{ id: 'far.islet.posts', name: STRINGS.islet, file: 'src/shards/far-reach/world/build.ts', category: 'props', surface: 'wood', part: 'bake', colliders: contact('', 'islet-rig') }],
});
scene('frames', routes.SKY_ROUTE_FRAMES.recipe, {
  registry: [{ ...registration(LAYOUT.FALLEN_BRIDGE.id, routes.SKY_ROUTE_FRAMES.bindings.fallen.part,
    contact(LAYOUT.FALLEN_BRIDGE.id)), active: 'frames.winch-up' }],
  publish: { ...routes.SKY_ROUTE_FRAMES.bindings, 'winch-up': { kind: 'number', value: 0 },
    'winch-at': routes.SKY_ROUTE_FRAMES.bindings.winchAt, 'notes-at': routes.SKY_ROUTE_FRAMES.bindings.notesAt },
});
scene('vanes', routes.SKY_VANES.recipe, {
  publish: routes.SKY_VANES.ports,
  registry: routes.SKY_VANES.bindings.map(row => registration(row.piece, row.part, contact(row.piece))),
});
for (const cube of ['standalone', 'cell'] as const) {
  const row = fixed[cube].fixed;
  const registry = [
    ...islets.pieces.map(piece => ({ id: piece.id, name: piece.name, file: piece.file, category: piece.category, surface: piece.surface,
      part: `islets.${piece.id}`, colliders: piece.colliders })),
    ...Object.values(row.bindings).flatMap(bindings => bindings.map(binding => registration(binding.piece, binding.part,
      'baked' in binding ? contact(binding.piece, row.recipe.imports.find(entry => entry.id === binding.baked && entry.kind === 'baked')?.piece, cube) : contact(binding.piece, undefined, cube)))),
  ];
  const recipe = parseWorldScene(row.recipe), parent = recipe.scene.nodes.find(node => node.id === 'islets.islet-static');
  if (parent?.kind !== 'group') throw new Error('Missing original static islet group');
  // Rails were a collision-only registry entry. Give those same contacts an
  // explicit empty owner rather than referring to a nonexistent visual part.
  parent.children.push('islets.far.islet.rails');
  recipe.scene.nodes.push({ kind: 'group', id: 'islets.far.islet.rails', children: [] });
  scene(`fixed-${cube}`, recipe, { cube, registry, publish: { millHub: { kind: 'object', part: 'mill.hub' } } });
}
scene('storm', { scene: rest.storm, imports: [] });
const moving = parseWorldScene({ scene: islets.scene, imports: [] });
moving.scene.nodes = moving.scene.nodes.map(node => {
  if (node.kind !== 'object' || !node.source.startsWith('islet.')) return node;
  const { source, ...frame } = node;
  return { ...frame, kind: 'mesh', geometry: source, material: 'isle-paint', missing: 'empty' };
});
moving.scene.materials.push({ kind: 'port', id: 'isle-paint', source: 'isle-paint' });
// Painted meshes use ShaderMaterial; the existing mesh binding requires a
// MeshStandardMaterial. Motion borrows their actual Object3D identities.
scene('moving-islets', moving, { publish: Object.fromEntries(moving.scene.nodes.filter(node => node.id !== 'root').map(node => [node.id, { kind: node.kind === 'mesh' ? 'object' : 'group', part: node.id }])) });
scene('meadow', { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: [] }], materials: [] }, imports: [] }, {
  draws: [{ kind: 'buffered', file: SKY_MEADOW_FILE, material: material('meadow') }],
});
// The Explorer's original neutral kit and vane are separate model steps. They
// borrow the same actual source geometry, never a rebuilt TS specimen.
scene('specimen-bridge', { scene: routes.SKY_BRIDGE_KIT, imports: [] }, { load: 'explorer' });
scene('specimen-vane', { scene: routes.SKY_VANE, imports: [] }, { load: 'explorer' });
const millRecipe = parseWorldScene(mill.MILL_SCENE.recipe);
millRecipe.scene.materials = millRecipe.scene.materials.map(row => row.id === 'foot'
  ? { kind: 'standard', id: 'foot', properties: { roughness: 0.85, metalness: 0 }, maps: { map: 'foot-map' } } : row);
millRecipe.scene.textures.push({ kind: 'port', id: 'foot-map', source: 'mill-foot' });
// The tower's mapped look uses the same original atlas as the live mill.
for (const row of millRecipe.scene.materials) if (row.kind === 'port' && row.source === 'tower') row.source = 'mill-tower:mill-tower';
scene('specimen-mill', millRecipe, { load: 'explorer', publish: mill.MILL_SCENE.bindings });
export const SKY_WORLD_SCENES = parseWorldScenes({ version: 1, libraries: [...SKY_SOURCE_LIBRARIES, SKY_ISLAND_LIBRARY, SKY_ISLE_TILES], materials: [...materials.values()], steps,
  cosmeticDraws: ground.SKY_GROUND.cosmeticDraws });

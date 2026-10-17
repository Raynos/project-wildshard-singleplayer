import STATIC_SCENES from '../data/staticScenes.generated.json' with { type: 'json' };
import ISLET_SCENES from '../data/isletScenes.generated.json' with { type: 'json' };
import { SKY_GROUND } from '../data/groundScene.generated';
import { SKY_ROUTE_FRAMES, SKY_ROUTE_SCENE, SKY_ROUTES, SKY_VANES } from '../data/routeScene.generated';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { createQuestPagePrompts, bindClientChannels, bindWorldSceneParts, createClientScene, createWorldScene } from '@wildshard/game/plugin/ui';
import type { SkyReachPlugin } from '../runtime/index';
import source from '../runtime/source';
import { SKY_LIBRARY, skyHd } from './meshes';
import { AdditiveBlending, MeshBasicMaterial, Group, type BufferGeometry, type Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { STRINGS } from '../data/strings';
import { islandMesh, isleMaterial, type IsleMeshes } from './isle';
import { WORLD } from './baked';
import { routeScenePorts, vaneGeometry } from './shapes';
import { crownStorm, type CrownStorm } from './storm';
import { STORM } from '../data/storm';

type ShardContext = Parameters<SkyReachPlugin['world']>[0];
const FILE = 'src/shards/far-reach/world/build.ts';
/** The baked placements for this session's cube (G99): standalone, or a grid cell of the half width they were baked for. */
function skyPlacements(cube: { readonly half: number } | null): typeof STATIC_SCENES.standalone {
  if (cube === null) return STATIC_SCENES.standalone;
  if (cube.half !== STATIC_SCENES.half) throw new Error(`far-reach: placements baked for a ${String(STATIC_SCENES.half)} m cube, not ${String(cube.half)}`);
  return STATIC_SCENES.cell;
}
export interface BuiltWorld {
  /** The hover decks' shared material: the plugin brightens it while the player rides the board. */
  readonly hoverDeck: MeshStandardMaterial;
  /** The fallen bridge's pivot on the step's rim; rotation.x runs from FALLEN_ANGLE (hanging) to 0 (raised). */
  readonly fallen: Object3D;
  readonly millHub: Object3D;
  /** The crown's storm vortex (the plugin turns it and fires its lightning). */
  readonly storm: CrownStorm;
  readonly vanes: readonly { readonly id: string; readonly flag: string; readonly at: Vector3; readonly rotor: Object3D }[];
  readonly winch: Interactable;
  readonly notes: Interactable;
  readonly notesAt: Vector3;
  /** Gameplay state the pieces' `active()` read. */
  readonly state: { raised: boolean; raising: boolean };
  /** SF49-g (G183): the moving islets and their chains, drawn at the movers' published poses. */
  readonly islets: ReturnType<typeof bindClientChannels>;
}

/**
 * The world, with SF49-g's four Rising Islet entries (G183; the only way in since G194), built a piece (or a few small
 * ones) per task (op-hitch41: a grid cell builds it on the road, in play, where the whole build was one 366 ms task on
 * the iOS Simulator). The same pieces in the same order, the same seeded draws. `pause` ends a piece's task (the plugin's
 * paced worldBuildYield, op-hitch45: in play a drawn frame when one is due, else a timer task of the shard's scope;
 * it rejects once the cell has unloaded, and the build stops). `looks` are the rope decks' wood and the hover frames' glow (`look.materials`).
 */
export async function buildWorld(ctx: ShardContext, pause: () => Promise<void>, isles: IsleMeshes, looks: { readonly deck: Material; readonly frame: Material; readonly channels: Parameters<typeof bindClientChannels>[0] }): Promise<BuiltWorld> {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const pieces = WORLD.placements(ctx.piece, root), spanColliders = (id: string) => pieces.colliders(id,'wood');
  const groundGeometry = new Map<string, BufferGeometry | null>(SKY_GROUND.isles.map(row => [row.id, isles.get(row.node)?.geometry ?? null]));
  const ground = createWorldScene(SKY_GROUND.recipe, {
    geometry: name => groundGeometry.get(name) ?? null, model: SKY_LIBRARY.model, baked: WORLD.object,
    materials: new Map(SKY_GROUND.looks.map(look => [look, isleMaterial(look)])),
  });
  for (let i = 0; i < SKY_GROUND.cosmeticDraws; i++) rnd();
  await pieces.scene(ground, SKY_GROUND.bindings, pause);
  await pause();
  const staticRows = skyPlacements(ctx.cube);
  const models = new Map(staticRows.models.map(name => [name, skyHd(name)]));
  const materials = new Map<string, Material | null>([['falls', SKY_LIBRARY.look('falls') ?? null], ['halo', new MeshBasicMaterial({ ...staticRows.fixed.halo, blending: AdditiveBlending })]]);
  for (const row of [...staticRows.recipe.scene.materials, ...staticRows.fixed.recipe.scene.materials]) {
    if (row.kind !== 'port' || row.source === undefined || materials.has(row.source)) continue;
    const [look, name] = row.source.split(':'), model = name === undefined ? undefined : models.get(name);
    materials.set(row.source, look === undefined || model === undefined || model === null ? null : SKY_LIBRARY.mappedLook(look, model.map));
  }
  const geometry = (name: string): BufferGeometry | null => name === 'fall' ? WORLD.geometry('geometries','fall',{index:'identity',empty:true})
    : name.startsWith('hero-') ? models.get(name.slice('hero-'.length))?.geometry ?? null : SKY_LIBRARY.geometry(name);
  const staticScene = createWorldScene(staticRows.recipe, { geometry, materials, model: SKY_LIBRARY.model, baked: WORLD.object });
  await pieces.scene(staticScene, staticRows.bindings, pause);
  await pause();

  // the rope rails and the hover decks' faint glass are declared in the scene (generators/routeScene.ts, E399)
  const routePorts = routeScenePorts(new Map<string, Material>([['deck', looks.deck], ['frame', looks.frame]]));
  const routes = createClientScene(SKY_ROUTE_SCENE, routePorts), hoverDeck = routes.standardMaterial('glass');
  if (hoverDeck === null) throw new Error('far-reach: the route scene lost its hover glass');
  await pieces.scene(routes, SKY_ROUTES.bindings, pause);
  // SF49-g (G183): the Rising Islets' static parts (the road lips, the chain posts); the islets move in the plugin's movers
  // G200: played alone (no road beyond the lips) each lip ends at a railed timber sky dock with a beacon; in a grid cell the
  // road socket continues there, so no dock
  const fixed = createWorldScene(staticRows.fixed.recipe, { geometry, materials, textures: new Map([...models].map(([id, model]) => [id, model?.map ?? null])), model: SKY_LIBRARY.model, baked: WORLD.object });
  for (const id of staticRows.fixed.textureOnly) models.get(id)?.geometry.dispose();
  for (const row of ISLET_SCENES.pieces) { const object = fixed.parts.get(`islets.${row.id}`); ctx.piece({ ...row, category: row.category === 'buildings' ? 'buildings' : 'props', surface: row.surface === 'stone' ? 'stone' : 'wood', ...(object === undefined ? {} : { object }), colliders: pieces.colliders(row.colliders) }); }
  const posts = WORLD.piece('islet-rig'); root.add(posts.root); ctx.piece({ id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: posts.root, colliders: posts.colliders, surface: 'wood' });
  await pieces.scene(fixed, staticRows.fixed.bindings.early);
  await pause();

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const frames = createWorldScene(SKY_ROUTE_FRAMES.recipe, routePorts);
  const { fallen, winchAt, notesAt } = bindWorldSceneParts(frames, { fallen: 'group', winchAt: 'vector', notesAt: 'vector' }, SKY_ROUTE_FRAMES.bindings);
  pieces.add(LAYOUT.FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(LAYOUT.FALLEN_BRIDGE.id), active: () => state.raised });

  await pause();
  await pieces.scene(fixed, staticRows.fixed.bindings.mill);
  const millHub = fixed.group('mill.hub'); if (millHub === null) throw new Error('Missing declared mill hub');

  await pause();
  await pieces.scene(fixed, staticRows.fixed.bindings.furniture);
  const [handle,notes] = createQuestPagePrompts(source,new Map([['frames',{winchAt,notesAt}]]),['winch','notes']);

  await pause();
  const vaneScene = createWorldScene(SKY_VANES.recipe, { geometry: vaneGeometry(), model: SKY_LIBRARY.model, baked: WORLD.object });
  const vaneParts = bindWorldSceneParts(vaneScene, SKY_VANES.kinds, SKY_VANES.ports);
  await pieces.scene(vaneScene, SKY_VANES.bindings, pause);
  const vanes = SKY_VANES.rows.map(row => ({ id: row.id, flag: row.flag, at: vaneParts[row.at], rotor: vaneParts[row.rotor] }));

  await pieces.scene(fixed, staticRows.fixed.bindings.crown);
  // the storm: a lit vortex high over the crown only (loop 3); it melts into the haze from the spawn
  await pause();
  const storm = crownStorm(rnd); storm.group.position.set(LAYOUT.CROWN.x, LAYOUT.CROWN.y + STORM.lift, LAYOUT.CROWN.z - STORM.ahead); storm.group.rotation.x = STORM.lean; root.add(storm.group);

  await pause();
  const scene = createClientScene(ISLET_SCENES.scene, { geometry: SKY_LIBRARY.geometry, objects: new Map(ISLET_SCENES.scene.nodes.flatMap(row => row.kind === 'object' && row.source !== undefined ? [[row.source, islandMesh(row.source)] as const] : [])) });
  const ids = ISLET_SCENES.rest.map(row => row.id);
  const islets = bindClientChannels(looks.channels.filter(row => row.mover !== undefined && ids.includes(row.mover) && row.connectors !== undefined), { targets: scene.parts, copiedOwners: ids, initialPoses: ISLET_SCENES.rest });
  root.add(scene.root);
  ctx.root.add(root); ctx.scope.ownPrimitives(root, { instances: true });
  return { hoverDeck, fallen, millHub, storm, vanes, winch: handle, notes, notesAt, state, islets };
}


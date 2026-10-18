import STATIC_SCENES from '../data/staticScenes.generated.json' with { type: 'json' };
import ISLET_SCENES from '../data/isletScenes.generated.json' with { type: 'json' };
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import groundScene from '../data/groundScene.generated.json' with { type: 'json' };
import routeScene from '../data/routeScene.generated.json' with { type: 'json' };
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { createQuestPagePrompts, bindClientChannels, createClientScene, createWorldScene } from '@wildshard/game/plugin/ui';
import type { SkyReachPlugin } from '../runtime/index';
import source from '../runtime/source';
import { SKY_LIBRARY, skyHd } from './meshes';
import { AdditiveBlending, MeshBasicMaterial, Group, type BufferGeometry, type Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { islandMesh, isleMaterial, type IsleMeshes } from './isle';
import { WORLD } from './baked';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';

const { SKY_GROUND } = groundScene;
const { SKY_VANES } = routeScene;

type ShardContext = Parameters<SkyReachPlugin['world']>[0];
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
    materials: new Map(SKY_GROUND.looks.map(look => [look, isleMaterial(look as Parameters<typeof isleMaterial>[0])])),
  });
  for (let i = 0; i < SKY_GROUND.cosmeticDraws; i++) rnd();
  await pieces.scene(ground, SKY_GROUND.bindings, pause);
  await pause();
  const staticRows = skyPlacements(ctx.cube);
  // OP5: each mapped look ends a task before the static scene is created (with it they were one long road frame on the
  // Simulator: 15 ms of JS on desktop); the same calls in the same order
  const models = new Map(staticRows.models.map(name => [name, skyHd(name)]));
  const materials = new Map<string, Material | null>([['falls', SKY_LIBRARY.look('falls') ?? null], ['halo', new MeshBasicMaterial({ ...staticRows.fixed.halo, blending: AdditiveBlending })]]);
  for (const row of [...staticRows.recipe.scene.materials, ...staticRows.fixed.recipe.scene.materials]) {
    if (row.kind !== 'port' || row.source === undefined || materials.has(row.source)) continue;
    const [look, name] = row.source.split(':'), model = name === undefined ? undefined : models.get(name);
    materials.set(row.source, look === undefined || model === undefined || model === null ? null : SKY_LIBRARY.mappedLook(look, model.map));
    await pause();
  }
  const geometry = (name: string): BufferGeometry | null => name === 'fall' ? WORLD.geometry('geometries','fall',{index:'identity',empty:true})
    : name.startsWith('hero-') ? models.get(name.slice('hero-'.length))?.geometry ?? null : SKY_LIBRARY.geometry(name);
  const staticScene = createWorldScene(staticRows.recipe, { geometry, materials, model: SKY_LIBRARY.model, baked: WORLD.object });
  await pieces.scene(staticScene, staticRows.bindings, pause);
  await pause();

  const handles = await installWorldScenes({ ...ctx, root }, ctx.product.section('world/scenes'));
  const hoverDeck = handles.standard('routes.glass');
  const state = { raised: false, raising: false };
  const fallen = handles.group('frames.fallen'), winchAt = handles.vector('frames.winchAt'), notesAt = handles.vector('frames.notesAt');
  pieces.add(LAYOUT.FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(LAYOUT.FALLEN_BRIDGE.id), active: () => state.raised });
  const millHub = handles.object(`fixed-${ctx.cube === null ? 'standalone' : 'cell'}.millHub`);
  const [handle, notes] = createQuestPagePrompts(source, new Map([['frames', { winchAt, notesAt }]]), ['winch', 'notes']);
  const vanes = SKY_VANES.rows.map(row => ({ id: row.id, flag: row.flag, at: handles.vector(`vanes.${row.at}`), rotor: handles.object(`vanes.${row.rotor}`) }));
  // the storm: a lit vortex high over the crown only (loop 3), its lightning flashed by the `storm-ring` / `storm-bolt` graphs
  await pause();
  root.add(createClientScene(REST_SCENES.storm, { geometry: SKY_LIBRARY.geometry, materials: new Map(['storm-ring', 'storm-bolt'].map(id => [id, SKY_LIBRARY.look(id) ?? new MeshBasicMaterial({ visible: false })])) }).root);

  await pause();
  const scene = createClientScene(ISLET_SCENES.scene, { geometry: SKY_LIBRARY.geometry, objects: new Map(ISLET_SCENES.scene.nodes.flatMap(row => row.kind === 'object' && row.source !== undefined ? [[row.source, islandMesh(row.source)] as const] : [])) });
  const ids = ISLET_SCENES.rest.map(row => row.id);
  const islets = bindClientChannels(looks.channels.filter(row => row.mover !== undefined && ids.includes(row.mover) && row.connectors !== undefined), { targets: scene.parts, copiedOwners: ids, initialPoses: ISLET_SCENES.rest });
  root.add(scene.root);
  ctx.root.add(root); ctx.scope.ownPrimitives(root, { instances: true });
  return { hoverDeck, fallen, millHub, vanes, winch: handle, notes, notesAt, state, islets };
}


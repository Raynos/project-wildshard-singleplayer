import STATIC_SCENES from '../data/staticScenes.generated.json' with { type: 'json' };
import ISLET_SCENES from '../data/isletScenes.generated.json' with { type: 'json' };
import { SKY_GROUND } from '../data/groundScene.generated';
import { SKY_ROUTE_FRAMES, SKY_ROUTE_SCENE, SKY_ROUTES } from '../data/routeScene.generated';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc } from '@wildshard/engine/world/registry';
import { questPagePrompt, bindClientChannels, bindWorldSceneParts, createClientScene, createWorldScene } from '@wildshard/game/plugin/ui';
import type { SkyReachPlugin } from '../runtime/index';
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import { SKY_LIBRARY, skyHd } from './meshes';
import { skyLook, skyMappedLook } from './looks';
import { Group, Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, FALLEN_BRIDGE, SUNREST, VANES } from '../data/layout';
import { STRINGS } from '../data/strings';
import { islandMesh, staticIsle, type IsleMeshes } from './isle';
import { crownArena } from './crown';
import { WORLD, skyBakedGeometry, skyBakedPiece, skyPieces } from './baked';
import { PALETTE, flat } from './materials';
import { ropeBridge, vane, windmill } from './shapes';
import { bookStand } from './bookStand';
import { BOOK_STAND } from '../data/bookStand';
import { KEEPER_STAND } from '../data/keeperStand';
import { crownStorm, type CrownStorm } from './storm';
import { STORM } from '../data/storm';
import { RISING_ISLETS } from '../data/islets.generated';
import { skyDocksFor } from './skyDock';

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
  readonly vanes: readonly { readonly id: string; readonly at: Vector3; readonly rotor: Object3D }[];
  readonly winch: Interactable;
  readonly winchAt: Vector3;
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
  const pieces = skyPieces(ctx.piece, root), spanColliders = (id: string) => pieces.colliders(id,'wood'), propColliders = pieces.colliders;
  const ground = createWorldScene(SKY_GROUND.recipe, {
    geometry: SKY_LIBRARY.geometry, model: SKY_LIBRARY.model, baked: WORLD.object,
    objects: new Map(SKY_GROUND.isles.map(row => [`isle.${row.id}`, staticIsle(isles, row.id, row.look)])),
  });
  for (let i = 0; i < SKY_GROUND.cosmeticDraws; i++) rnd();
  await pieces.scene(ground, SKY_GROUND.bindings, pause);
  await pause();
  const staticRows = skyPlacements(ctx.cube);
  const models = new Map(staticRows.models.map(name => [name, skyHd(name)]));
  const materials = new Map<string, Material | null>([['falls', skyLook('falls') ?? null]]);
  for (const row of staticRows.recipe.scene.materials) {
    if (row.kind !== 'port' || row.source === 'falls') continue;
    const [look, name] = row.source.split(':'), model = name === undefined ? undefined : models.get(name);
    materials.set(row.source, look === undefined || model === undefined || model === null ? null : skyMappedLook(look, model.map));
  }
  const staticScene = createWorldScene(staticRows.recipe, {
    geometry: name => name === 'fall' ? skyBakedGeometry('fall') : models.get(name.slice('hero-'.length))?.geometry ?? null,
    materials, model: SKY_LIBRARY.model, baked: WORLD.object,
  });
  await pieces.scene(staticScene, staticRows.bindings, pause);
  await pause();

  const rope = flat(PALETTE.rope);
  // faint glass while you walk (E399, the council: 'translucent rectangles' over the windmill isle from the spawn): the glowing
  // frame shows the path; the plugin fills the glass in while you ride
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.16, depthWrite: false, flatShading: false, roughness: 0.15, metalness: 0.1 });
  const post = skyHd('post-hd'), routes = createClientScene(SKY_ROUTE_SCENE, {
    geometry: name => { const geometry = name === 'post-hd' ? post?.geometry ?? null : SKY_LIBRARY.geometry(name);
      if (geometry === null && name !== 'post-hd') throw new Error(`Missing route part ${name}`); return geometry; },
    materials: new Map<string, Material | null>([['rails', rope], ['deck', looks.deck], ['glass', hoverDeck], ['frame', looks.frame],
      ['posts', post === null ? null : skyMappedLook('post-weather', post.map)]]),
  });
  await pieces.scene(routes, SKY_ROUTES.bindings, pause);
  // SF49-g (G183): the Rising Islets' static parts (the road lips, the chain posts); the islets move in the plugin's movers
  // G200: played alone (no road beyond the lips) each lip ends at a railed timber sky dock with a beacon; in a grid cell the
  // road socket continues there, so no dock
  const staticIslets = createClientScene(ISLET_SCENES.staticScene, { geometry: SKY_LIBRARY.geometry }); root.add(staticIslets.root);
  for (const row of ISLET_SCENES.pieces) { const object = staticIslets.parts.get(row.id); ctx.piece({ ...row, category: row.category === 'buildings' ? 'buildings' : 'props', surface: row.surface === 'stone' ? 'stone' : 'wood', ...(object === undefined ? {} : { object }), colliders: pieces.colliders(row.colliders) }); }
  const posts = skyBakedPiece('islet-rig'); root.add(posts.root); ctx.piece({ id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: posts.root, colliders: posts.colliders, surface: 'wood' });
  for (const piece of skyDocksFor(ctx.cube)) { if (piece.object !== undefined) root.add(piece.object); ctx.piece(piece); }
  await pause();

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const frames = createWorldScene(SKY_ROUTE_FRAMES.recipe, { objects: new Map([['fallen-deck', ropeBridge(FALLEN_BRIDGE.id, rope, looks.deck)]]),
    geometry: SKY_LIBRARY.geometry, model: SKY_LIBRARY.model, baked: WORLD.object });
  const { fallen, winchAt, notesAt } = bindWorldSceneParts(frames, { fallen: 'group', winchAt: 'vector', notesAt: 'vector' }, SKY_ROUTE_FRAMES.bindings);
  pieces.add(FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(FALLEN_BRIDGE.id), active: () => state.raised });

  await pause();
  const mill = windmill(); pieces.add('far.windmill', mill.group, { colliders: propColliders('far.windmill') });

  await pause();
  pieces.add('far.winch', createClientScene(REST_SCENES.winch, { geometry: SKY_LIBRARY.geometry }).root, { colliders: propColliders('far.winch') });
  const handle = questPagePrompt(STRINGS.turnWinch,winchAt,3);

  pieces.add('far.notes', bookStand(false), { colliders: propColliders('far.notes') });
  // the keeper's own book stand and lantern beside him at the spawn (E399, mockup B)
  const stand = bookStand(true); stand.position.set(KEEPER_STAND.x, SUNREST.y, KEEPER_STAND.z); stand.rotation.y = KEEPER_STAND.yaw;
  pieces.add('far.keeper.stand', stand, { colliders: [boxDesc({ x: KEEPER_STAND.x, z: KEEPER_STAND.z, hw: BOOK_STAND.footprint, hd: BOOK_STAND.footprint, rot: KEEPER_STAND.yaw, yBottom: stand.position.y, yTop: stand.position.y + BOOK_STAND.height }, 'wood')] });
  const notes = questPagePrompt(STRINGS.readNotes,notesAt,2.6);

  await pause();
  const vanes: BuiltWorld['vanes'][number][] = [];
  for (const v of VANES) {
    const built = vane(); pieces.add(`far.vane.${v.id}`, built.group, { colliders: propColliders(`far.vane.${v.id}`) });
    vanes.push({ id: v.id, at: new Vector3(v.x, v.y + 3.3, v.z), rotor: built.rotor });
    await pause();
  }

  // the arena (loop 4, mockup D): standing stones with wind glyphs, pennant ropes, the compass-rose dais
  // (SF72: built offline, generators/crown.ts → baked/crown.glb; its colliders, the dais and each stone, are the rows')
  const arena = crownArena();
  await pause();
  pieces.add('far.crown.ruin', arena.group, { colliders: arena.colliders });
  // the winch house on the high step (loop 5): the updraft view's landmark
  // (SF72: built offline, generators/winchHouse.ts → baked/winch-house.glb; drawn from the bake)
  pieces.baked('far.step.winch-house');
  // the Roost's nest and spires (loop 4, review H2): the drift rays' island gets its subject
  // (SF72: built offline, generators/roost.ts → baked/roost.glb; drawn from the bake, the sticks' and feathers' tints restored)
  pieces.baked('far.roost.nest');
  // the storm: a lit vortex high over the crown only (loop 3); it melts into the haze from the spawn
  await pause();
  const storm = crownStorm(rnd); storm.group.position.set(CROWN.x, CROWN.y + STORM.lift, CROWN.z - STORM.ahead); storm.group.rotation.x = STORM.lean; root.add(storm.group);

  await pause();
  const scene = createClientScene(ISLET_SCENES.scene, { geometry: SKY_LIBRARY.geometry, objects: new Map(RISING_ISLETS.map(entry => [`islet.${entry.edge}`, islandMesh(`islet.${entry.edge}`)])) });
  const rest = new Map(ISLET_SCENES.rest.map(row => [row.id, row])), ids = [...rest.keys()];
  const islets = bindClientChannels(looks.channels.filter(row => row.mover !== undefined && ids.includes(row.mover) && row.connectors !== undefined), { targets: scene.parts, copiedOwners: ids });
  islets.updateMovers(id => { const pose = rest.get(id); if (pose === undefined) throw new Error('Missing initial islet pose'); return pose; });
  root.add(scene.root);
  ctx.root.add(root); ctx.scope.ownPrimitives(root, { instances: true });
  return { hoverDeck, fallen, millHub: mill.hub, storm, vanes, winch: handle, winchAt, notes, notesAt, state, islets };
}

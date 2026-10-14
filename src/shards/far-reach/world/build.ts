import STATIC_SCENES from '../data/staticScenes.generated.json' with { type: 'json' };
import ISLET_SCENES from '../data/isletScenes.generated.json' with { type: 'json' };
import { ISLE_DRAWS } from '../data/isleLook';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type Piece } from '@wildshard/engine/world/registry';
import { bindClientChannels, createClientScene, createWorldScene } from '@wildshard/game/plugin/ui';
import type { SkyReachPlugin } from '../runtime/index';
import { spanYaw, spanPitch } from '../layout';
import { FALLEN_ANGLE } from '../data/moverBindings';
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import { SKY_LIBRARY, skyHd } from './meshes';
import { skyLook, skyMappedLook } from './looks';
import { Group, Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, FALLEN_BRIDGE, ISLES, KNOLLS, NOTES, SPANS, SUNREST, UPDRAFT, VANES, WINCH } from '../data/layout';
import { STRINGS } from '../data/strings';
import { islandMesh, staticIsle, type IsleMeshes } from './isle';
import { crownArena } from './crown';
import { ISLE_KEEL_CUT } from '../data/skyIsles';
import { WORLD, skyBakedGeometry, skyBakedPiece, skyKnollHulls, skyPieces } from './baked';
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
const HOVER_SCENES = new Map(REST_SCENES.hover.map(row => [row.id, row.scene]));
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
 * How far under its deck a playable island's code keel is cut away (the textured keel model carries the rock below), and
 * where that model's turf sits under the deck. The windmill isle (round 6: under A's bridge a dark wall where the mockups
 * show lit cloud; they stand the mill on a rooted spur): a short lip over a narrower keel that overlaps it.
 */
// (round 13, seat A 5: 'the broad faceted apron below the deck': the code band was 3.2 m, 1.6 on the mill isle; the
// modelled rock now starts just under the turf)
const CUT = ISLE_KEEL_CUT;
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
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove,
    keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  // SF49-g (G183): the four gate isles join the islands (every shape baked, generators/isles.ts; drawn from the props tiles,
  // generators/isleProps.ts, each at its own position); a playable island still takes its ISLE_DRAWS cosmetic values, so
  // every draw after the islands is unchanged
  for (const isle of [...ISLES, ...RISING_ISLETS.map(entry => entry.gate)]) {
    // the code keel ends a little under the lip (E399 round 3, item 2: 'under the bridge a grey-green cliff wall where the
    // mockups show open cloud'): the textured keel model below (far.isle-keels) is the rock you see, narrower, with sky
    // round it; the top, the lip and every collider are unchanged (a gate isle has no keel model: its code keel stays whole)
    const gate = RISING_ISLETS.map(entry => entry.gate).includes(isle), mesh = staticIsle(isles, isle.id, gate ? 'isle-paint' : CUT[isle.id] === undefined ? 'isle-paint-cut' : 'isle-paint-cut-mill'); root.add(mesh);
    if (!gate) for (let i = 0; i < ISLE_DRAWS; i++) rnd();
    ctx.piece({ id: `far.isle.${isle.id}`, name: names[isle.id] ?? (gate ? STRINGS.gateIsle : isle.id), category: 'ground', file: FILE, object: mesh, colliders: pieces.colliders(`far.isle.${isle.id}`,'grass'), surface: 'grass' });
    await pause();
  }
  // the grassy rises (E399: proposal B's hill on the bridge's axis, mockup D's look down into the arena), walkable on their hulls
  // (SF72: built offline, generators/knoll.ts → baked/knolls.glb; each collided by its rows' hull)
  const knolls = skyBakedPiece('knolls'), hulls = skyKnollHulls();
  for (const k of KNOLLS) {
    const isle = ISLES.find((i) => i.id === k.isle), hull = hulls.get(k.id); if (isle === undefined || hull === undefined) continue;
    const knoll = knolls.kinds.get(k.id) ?? new Group(); knoll.name = `far.knoll.${k.id}`; root.add(knoll);
    ctx.piece({ id: `far.${k.id}.knoll`, name: names[isle.id] ?? isle.id, category: 'ground', file: FILE, object: knoll, colliders: [hull], surface: 'grass' });
  }
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
  // SF49-g (G183): each gate isle's rope bridge to its island is one more rope span of the same builder
  const bridges: Piece[] = [];
  for (const span of [...SPANS, ...RISING_ISLETS.map((entry) => entry.bridge)]) {
    const hover = span.kind === 'hover', bridge = hover ? createClientScene(HOVER_SCENES.get(span.id), { geometry: SKY_LIBRARY.geometry, materials: new Map([['glass', hoverDeck], ['frame', looks.frame]]) }).root : ropeBridge(span.id, rope, looks.deck);
    bridge.position.set(span.x0, span.y, span.z0); bridge.rotation.set(spanPitch(span), spanYaw(span), 0, 'YXZ');
    const piece: Piece = { id: span.id, name: hover ? STRINGS.hover : STRINGS.rope, category: 'buildings', file: FILE, object: bridge,
      colliders: spanColliders(span.id), surface: 'wood' };
    if (hover) piece.mode = 'board'; // SF34: a hover-only deck, solid only under the board
    bridges.push(piece);
    await pause();
  }
  // SF49-g (G183): the Rising Islets' static parts (the road lips, the chain posts); the islets move in the plugin's movers
  // G200: played alone (no road beyond the lips) each lip ends at a railed timber sky dock with a beacon; in a grid cell the
  // road socket continues there, so no dock
  const staticIslets = createClientScene(ISLET_SCENES.staticScene, { geometry: SKY_LIBRARY.geometry }); root.add(staticIslets.root);
  for (const row of ISLET_SCENES.pieces) { const object = staticIslets.parts.get(row.id); ctx.piece({ ...row, category: row.category === 'buildings' ? 'buildings' : 'props', surface: row.surface === 'stone' ? 'stone' : 'wood', ...(object === undefined ? {} : { object }), colliders: pieces.colliders(row.colliders) }); }
  const posts = skyBakedPiece('islet-rig'); root.add(posts.root); ctx.piece({ id: 'far.islet.posts', name: STRINGS.islet, category: 'props', file: FILE, object: posts.root, colliders: posts.colliders, surface: 'wood' });
  for (const piece of [...bridges, ...skyDocksFor(ctx.cube)]) { if (piece.object !== undefined) root.add(piece.object); ctx.piece(piece); }
  await pause();

  // The updraft: a board-only rising wind ramp (a hover deck tilted up the wind column) from the windmill isle to the step.
  const ramp = createClientScene(HOVER_SCENES.get(UPDRAFT.id), { geometry: SKY_LIBRARY.geometry, materials: new Map([['glass', hoverDeck], ['frame', looks.frame]]) }).root;
  ramp.position.set(UPDRAFT.x0, UPDRAFT.y, UPDRAFT.z0); ramp.rotation.set(spanPitch(UPDRAFT), spanYaw(UPDRAFT), 0, 'YXZ');
  pieces.add('far.updraft', ramp, { colliders: spanColliders('far.updraft') });
  await pause();

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = ropeBridge(FALLEN_BRIDGE.id, rope, looks.deck);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0); fallen.rotation.set(FALLEN_ANGLE, spanYaw(FALLEN_BRIDGE), 0, 'YXZ');
  pieces.add(FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(FALLEN_BRIDGE.id), active: () => state.raised });

  await pause();
  const mill = windmill(); pieces.add('far.windmill', mill.group, { colliders: propColliders('far.windmill') });

  await pause();
  pieces.add('far.winch', createClientScene(REST_SCENES.winch, { geometry: SKY_LIBRARY.geometry }).root, { colliders: propColliders('far.winch') });
  const winchAt = new Vector3(WINCH.x, WINCH.y + 1.2, WINCH.z);
  const handle: Interactable = { label: STRINGS.turnWinch, position: winchAt, radius: 3, onInteract: () => { if (!state.raised) state.raising = true; } };

  pieces.add('far.notes', bookStand(false), { colliders: propColliders('far.notes') });
  // the keeper's own book stand and lantern beside him at the spawn (E399, mockup B)
  const stand = bookStand(true); stand.position.set(KEEPER_STAND.x, SUNREST.y, KEEPER_STAND.z); stand.rotation.y = KEEPER_STAND.yaw;
  pieces.add('far.keeper.stand', stand, { colliders: [boxDesc({ x: KEEPER_STAND.x, z: KEEPER_STAND.z, hw: BOOK_STAND.footprint, hd: BOOK_STAND.footprint, rot: KEEPER_STAND.yaw, yBottom: stand.position.y, yTop: stand.position.y + BOOK_STAND.height }, 'wood')] });
  const notesAt = new Vector3(NOTES.x, NOTES.y + 1.3, NOTES.z);
  const notes: Interactable = { label: STRINGS.readNotes, position: notesAt, radius: 2.6, onInteract: () => undefined };

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

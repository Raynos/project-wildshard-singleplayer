import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { ISLE_CUT_EDITS } from '../data/paintLook';
import { ISLE_DRAWS } from '../data/isleLook';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc, type Piece } from '@wildshard/engine/world/registry';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Group, Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, FALLEN_BRIDGE, ISLES, KNOLLS, MILL, NOTES, PINES, SPANS, STEP, SUNREST, UPDRAFT, VANES, WINCH, WINCH_HOUSE, type Span } from '../data/layout';
import { STRINGS } from '../data/strings';
import { dressIslands } from './dressing';
import { islandMesh } from './isle';
import { crownArena } from './crown';
import { trees } from './trees';
import { ISLE_CUT, ISLE_KEEL_CUT, SKY_ISLES } from '../data/skyIsles';
import skyIslePines from '../data/skyIslePines.json' with { type: 'json' };
import BRIDGE_PHYSICS from '../data/bridgePhysics.generated.json' with { type: 'json' };
import PLACEMENTS from '../data/physicsPlacements.generated.json' with { type: 'json' };
import { inCube, skyIslesIn } from './skyIsles';
import { keelIsles, skyIsleModels } from './skyIsleHd';
import { skyBakedPiece, skyKnollHulls } from './baked';
import { skyline } from './distant';
import { PALETTE, flat, hoverBridge, ropeBridge, vane, windmill, winch } from './shapes';
import { bookStand } from './bookStand';
import { BOOK_STAND } from '../data/bookStand';
import { KEEPER_STAND } from '../quest/keeper';
import { ownPrimitives } from './resources';
import { crownStorm, type CrownStorm } from './storm';
import { STORM } from '../data/storm';
import { updraftFx, type UpdraftFx } from '../runtime/looks/windFx';
import { UPDRAFT_FX } from '../data/windLook';
import { SUN_DIR } from '../look/sun';
import { seaTexture } from '../look/cloudSea';
import { GATE_ISLES, isletPieces, isletViews, type IsletViews } from './risingIslet';
import { RISING_ISLETS } from './islets';
import { skyDocksFor } from './skyDock';

const FILE = 'src/shards/far-reach/world/build.ts';
/** How far the fallen bridge hangs below level (radians about its pivot). */
export const FALLEN_ANGLE = -1.25;
/** The updraft ramp's climb (radians); under the 40° walk limit. */

/** A span's run: its horizontal heading (yaw, the bridge's local −Z) and its slope (pitch, raising the far end). */
export const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.y1 - span.y, span.z1 - span.z0);
export const spanYaw = (span: Span): number => Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0));
export const spanPitch = (span: Span): number => Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0));
/** The updraft's climb (radians; under the 40° walk limit) and its run along the slope. */
export const UPDRAFT_ANGLE = spanPitch(UPDRAFT);
export const UPDRAFT_LENGTH = spanLength(UPDRAFT);
/** A baked row's colliders (data/*.generated.json, compiled by the shard's generators): boxes and hulls, by piece id. */
interface BakedCollider {
  readonly kind: string; readonly x: number; readonly y: number; readonly z: number; readonly surface: string;
  readonly hx?: number; readonly hy?: number; readonly hz?: number; readonly yaw?: number;
  readonly rot?: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }; readonly points?: readonly number[];
}
const SURFACES = ['wood', 'grass', 'stone'] as const;
/** The row's colliders; `surface` (when set) is the one surface every collider must have. */
function bakedColliders(rows: readonly { readonly id: string; readonly colliders: readonly BakedCollider[] }[], id: string, surface?: typeof SURFACES[number]): ColliderDesc[] {
  const row = rows.find((p) => p.id === id);
  if (row === undefined) throw new Error(`far-reach: no baked colliders for ${id}`);
  return row.colliders.map((c): ColliderDesc => {
    const own = SURFACES.find((k) => k === c.surface);
    if (own === undefined || (surface !== undefined && own !== surface)) throw new Error(`far-reach: ${id} holds a ${c.kind} ${c.surface} collider`);
    if (c.kind === 'hull' && c.points !== undefined) return { kind: 'hull', x: c.x, y: c.y, z: c.z, points: new Float32Array(c.points), surface: own };
    if (c.kind !== 'box' || c.hx === undefined || c.hy === undefined || c.hz === undefined) throw new Error(`far-reach: ${id} holds a ${c.kind} collider`);
    return c.rot === undefined ? { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, yaw: c.yaw ?? 0, surface: own }
      : { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, rot: { x: c.rot.x, y: c.rot.y, z: c.rot.z, w: c.rot.w }, surface: own };
  });
}
/** The rope spans' sagged decks and rails, the hover decks, the updraft and the fallen bridge (generators/bridgeColliders.ts). */
const spanColliders = (id: string): ColliderDesc[] => bakedColliders(BRIDGE_PHYSICS, id, 'wood');
/** The windmill (its tower and rock drum), the winch, the notes and the vanes (generators/physicsPlacements.ts). */
const propColliders = (id: string): ColliderDesc[] => bakedColliders(PLACEMENTS, id);
export interface BuiltWorld {
  /** The hover decks' shared material: the plugin brightens it while the player rides the board. */
  readonly hoverDeck: MeshStandardMaterial;
  /** The updraft's wind spiral; the plugin turns it. */
  readonly wind: UpdraftFx;
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
  readonly islets: IsletViews;
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
 * it rejects once the cell has unloaded, and the build stops).
 */
export async function buildWorld(ctx: ShardContext, pause: () => Promise<void>): Promise<BuiltWorld> {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove,
    keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  // SF49-g (G183): the four gate isles join the islands (every shape baked, generators/isles.ts); a playable island still
  // takes its ISLE_DRAWS cosmetic values, so every draw after the islands is unchanged
  for (const isle of [...ISLES, ...GATE_ISLES]) {
    const gate = GATE_ISLES.includes(isle), mesh = islandMesh(isle.id); mesh.position.set(isle.x, isle.y, isle.z); root.add(mesh);
    if (!gate) for (let i = 0; i < ISLE_DRAWS; i++) rnd();
    // the code keel ends a little under the lip (E399 round 3, item 2: 'under the bridge a grey-green cliff wall where the
    // mockups show open cloud'): the textured keel model below (far.isle-keels) is the rock you see, narrower, with sky
    // round it; the top, the lip and every collider are unchanged (a gate isle has no keel model: its code keel stays whole)
    if (!gate) patchShader(mesh.material, 'far.isle-cut', PATCH_ORDER.decorate, (shader) => {
      shader.uniforms['farCut'] = { value: isle.y - (CUT[isle.id]?.cut ?? ISLE_CUT) };
      editShader(shader, ISLE_CUT_EDITS);
    }, { key: (prior) => `${prior}|far.isle-cut` });
    ctx.piece({ id: `far.isle.${isle.id}`, name: names[isle.id] ?? (gate ? STRINGS.gateIsle : isle.id), category: 'ground', file: FILE, object: mesh, colliders: bakedColliders(PLACEMENTS, `far.isle.${isle.id}`, 'grass'), surface: 'grass' });
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
  const pineAt: [number, number, number, number][] = [];
  for (const isle of ISLES) for (const [dx, dz, s] of PINES[isle.id] ?? []) pineAt.push([isle.x + dx, isle.y, isle.z + dz, s]);
  // a pine on each gate isle beside the chain posts (the board's tree over the islet)
  for (const isle of GATE_ISLES) pineAt.push([isle.x + 3, isle.y, isle.z - 3, 0.9]);
  // E392/E399: the sky around the archipelago, the textured floating-island models (world/skyIsleHd.ts; one that did not load stands undrawn)
  const skyGroup = new Group(); skyGroup.name = 'far.sky-isles';
  // G99: in a grid cell only the isles inside the 500 m cube (ctx.cube); standalone every one
  const skyIsles = skyIslesIn(ctx.cube), half = ctx.cube?.half ?? null;
  const skyHd = skyIsleModels(skyIsles); skyGroup.add(skyHd.group);
  await pause();
  // the playable islands' keels in the same painted rock (E399 round 2, seat C: 'under the bridge a flat sage-green cliff
  // wall'): a model under each island, its turf 1.8 m under the walkable top (its turf mounds poked up through the arena floor at 0.7 m), so
  // the rock below are the textured ones; the code top and its colliders are unchanged, nothing here collides
  const keels = skyIsleModels(keelIsles(ISLES), true);
  keels.group.name = 'far.isle-keels'; skyGroup.add(keels.group);
  await pause();
  const SKY_ISLE_PINES: Readonly<Record<string, readonly { x: number; z: number; size: number; y: number | null }[]>> = skyIslePines;
  // the firs placed offline (generators/skyIslePines.ts): on a model's turf or not at all
  for (const s of SKY_ISLES) if (half === null || inCube(s, half)) for (const p of SKY_ISLE_PINES[s.id] ?? []) if (p.y !== null) pineAt.push([p.x, p.y, p.z, p.size]);
  root.add(skyGroup);
  ctx.piece({ id: 'far.sky-isles', name: STRINGS.skyIsles, category: 'props', file: FILE, object: skyGroup });
  // the modelled trees (top-10 row 2; none stand when a model did not load)
  const forest = trees(pineAt) ?? new Group(); root.add(forest);
  ctx.piece({ id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE, object: forest });
  await pause();
  // the meadow and the roots (loop 2): grass clumps, flowers, stones, hanging roots; no colliders
  const dress = dressIslands(); root.add(dress.group);
  ctx.piece({ id: 'far.dressing', name: STRINGS.meadow, category: 'props', file: FILE, object: dress.group });
  await pause();
  // the skyline: decorative 3-D islands and waterfalls out past the archipelago, and the windmill isle's fall
  const sky = skyline(ISLES, (isle, a) => skyHd.lipAt(isle, a), skyIsles); root.add(sky);
  await pause();

  const rope = flat(PALETTE.rope);
  // faint glass while you walk (E399, the council: 'translucent rectangles' over the windmill isle from the spawn): the glowing
  // frame shows the path; the plugin fills the glass in while you ride
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.16, depthWrite: false, flatShading: false, roughness: 0.15, metalness: 0.1 });
  // SF49-g (G183): each gate isle's rope bridge to its island is one more rope span of the same builder
  const bridges: Piece[] = [];
  for (const span of [...SPANS, ...RISING_ISLETS.map((entry) => entry.bridge)]) {
    const hover = span.kind === 'hover', length = spanLength(span), bridge = hover ? hoverBridge(length, span.width, hoverDeck) : ropeBridge(span.id, rope);
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
  for (const piece of [...bridges, ...isletPieces(), ...skyDocksFor(ctx.cube)]) { if (piece.object !== undefined) root.add(piece.object); ctx.piece(piece); }
  await pause();

  // The updraft: a board-only rising wind ramp (a hover deck tilted up the wind column) from the windmill isle to the step.
  const ramp = hoverBridge(UPDRAFT_LENGTH, UPDRAFT.width, hoverDeck);
  ramp.position.set(UPDRAFT.x0, UPDRAFT.y, UPDRAFT.z0); ramp.rotation.set(UPDRAFT_ANGLE, spanYaw(UPDRAFT), 0, 'YXZ'); root.add(ramp);
  // the wind column: a spiral of streaks and leaves up the ramp (loop 3; the plugin turns it)
  const wind = updraftFx(UPDRAFT_FX, new Vector3(UPDRAFT.x0, UPDRAFT.y + 2.2, UPDRAFT.z0), new Vector3(UPDRAFT.x1, UPDRAFT.y1 + 2.2, UPDRAFT.z1));
  for (const o of wind.objects) root.add(o); wind.update(0);
  await pause();
  ctx.piece({ id: 'far.updraft', name: STRINGS.updraft, category: 'buildings', file: FILE, object: ramp, colliders: spanColliders('far.updraft'), surface: 'wood', mode: 'board' });

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = ropeBridge(FALLEN_BRIDGE.id, rope);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0); fallen.rotation.set(FALLEN_ANGLE, spanYaw(FALLEN_BRIDGE), 0, 'YXZ'); root.add(fallen);
  ctx.piece({ id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, object: fallen,
    colliders: spanColliders(FALLEN_BRIDGE.id), surface: 'wood', active: () => state.raised });

  await pause();
  const mill = windmill(); mill.group.position.set(MILL.x, 30, MILL.z); mill.group.rotation.y = MILL.yaw; root.add(mill.group);
  ctx.piece({ id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, object: mill.group,
    colliders: propColliders('far.windmill'), surface: 'stone' });

  await pause();
  const drum = winch(); drum.position.set(WINCH.x, WINCH.y, WINCH.z); root.add(drum);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: drum,
    colliders: propColliders('far.winch'), surface: 'wood' });
  const winchAt = new Vector3(WINCH.x, WINCH.y + 1.2, WINCH.z);
  const handle: Interactable = { label: STRINGS.turnWinch, position: winchAt, radius: 3, onInteract: () => { if (!state.raised) state.raising = true; } };

  const page = bookStand(false); page.position.set(NOTES.x, NOTES.y, NOTES.z); page.rotation.y = 0.6; root.add(page);
  ctx.piece({ id: 'far.notes', name: STRINGS.notesName, category: 'props', file: FILE, object: page,
    colliders: propColliders('far.notes'), surface: 'wood' });
  // the keeper's own book stand and lantern beside him at the spawn (E399, mockup B)
  const stand = bookStand(true); stand.position.set(KEEPER_STAND.x, SUNREST.y, KEEPER_STAND.z); stand.rotation.y = KEEPER_STAND.yaw; root.add(stand);
  ctx.piece({ id: 'far.keeper.stand', name: STRINGS.notesName, category: 'props', file: FILE, object: stand,
    colliders: [boxDesc({ x: KEEPER_STAND.x, z: KEEPER_STAND.z, hw: BOOK_STAND.footprint, hd: BOOK_STAND.footprint, rot: KEEPER_STAND.yaw, yBottom: stand.position.y, yTop: stand.position.y + BOOK_STAND.height }, 'wood')], surface: 'wood' });
  const notesAt = new Vector3(NOTES.x, NOTES.y + 1.3, NOTES.z);
  const notes: Interactable = { label: STRINGS.readNotes, position: notesAt, radius: 2.6, onInteract: () => undefined };

  await pause();
  const vanes: BuiltWorld['vanes'][number][] = [];
  for (const v of VANES) {
    const built = vane(); built.group.position.set(v.x, v.y, v.z); root.add(built.group);
    ctx.piece({ id: `far.vane.${v.id}`, name: STRINGS.vane, category: 'props', file: FILE, object: built.group,
      colliders: propColliders(`far.vane.${v.id}`), surface: 'wood' });
    vanes.push({ id: v.id, at: new Vector3(v.x, v.y + 3.3, v.z), rotor: built.rotor });
    await pause();
  }

  // the arena (loop 4, mockup D): standing stones with wind glyphs, pennant ropes, the compass-rose dais
  // (SF72: built offline, generators/crown.ts → baked/crown.glb; its colliders, the dais and each stone, are the rows')
  const arena = crownArena(); root.add(arena.group);
  await pause();
  ctx.piece({ id: 'far.crown.ruin', name: STRINGS.crown, category: 'buildings', file: FILE, object: arena.group, surface: 'stone', colliders: arena.colliders });
  // the winch house on the high step (loop 5): the updraft view's landmark
  // (SF72: built offline, generators/winchHouse.ts → baked/winch-house.glb; drawn from the bake)
  const house = skyBakedPiece('winch-house'); house.root.name = 'far.step.winch-house'; house.root.position.set(WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z); root.add(house.root);
  ctx.piece({ id: 'far.step.winch-house', name: STRINGS.winch, category: 'buildings', file: FILE, object: house.root, colliders: house.colliders, surface: 'stone' });
  // the Roost's nest and spires (loop 4, review H2): the drift rays' island gets its subject
  // (SF72: built offline, generators/roost.ts → baked/roost.glb; drawn from the bake, the sticks' and feathers' tints restored)
  const nest = skyBakedPiece('roost'); nest.root.name = 'far.roost.nest'; root.add(nest.root);
  ctx.piece({ id: 'far.roost.nest', name: STRINGS.roost, category: 'props', file: FILE, object: nest.root, colliders: nest.colliders, surface: 'wood' });
  // the storm: a lit vortex high over the crown only (loop 3); it melts into the haze from the spawn
  await pause();
  const stormTex = seaTexture(); ctx.scope.own(stormTex);
  const storm = crownStorm(SUN_DIR, stormTex, rnd); storm.group.position.set(CROWN.x, CROWN.y + STORM.lift, CROWN.z - STORM.ahead); storm.group.rotation.x = STORM.lean; root.add(storm.group);

  await pause();
  const islets = isletViews();
  root.add(islets.group);
  ctx.root.add(root); ownPrimitives(root, ctx.scope);
  return { hoverDeck, wind, fallen, millHub: mill.hub, storm, vanes, winch: handle, winchAt, notes, notesAt, state, islets };
}

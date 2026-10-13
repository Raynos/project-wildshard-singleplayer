import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { ISLE_CUT_EDITS } from '../data/paintLook';
import { ISLE_DRAWS } from '../data/isleLook';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc, type Piece } from '@wildshard/engine/world/registry';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Group, Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, FALLEN_BRIDGE, ISLES, KNOLLS, NOTES, SPANS, SUNREST, UPDRAFT, VANES, WINCH, type Span } from '../data/layout';
import { STRINGS } from '../data/strings';
import { staticIsle, type IsleMeshes } from './isle';
import { crownArena } from './crown';
import { trees } from './trees';
import { ISLE_CUT, ISLE_KEEL_CUT } from '../data/skyIsles';
import PLACEMENTS_BAKED from '../data/placements.json' with { type: 'json' };
import BRIDGE_PHYSICS from '../data/bridgePhysics.generated.json' with { type: 'json' };
import PLACEMENTS from '../data/physicsPlacements.generated.json' with { type: 'json' };
import { skyIsleModels } from './skyIsleHd';
import { skyBakedPiece, skyKnollHulls, skyPieces } from './baked';
import { ownPrimitives } from './resources';
import { skyline } from './distant';
import { PALETTE, flat, hoverBridge, ropeBridge, vane, windmill, winch } from './shapes';
import { bookStand } from './bookStand';
import { BOOK_STAND } from '../data/bookStand';
import { KEEPER_STAND } from '../quest/keeper';
import { crownStorm, type CrownStorm } from './storm';
import { STORM } from '../data/storm';
import { updraftFx, type UpdraftFx } from '../runtime/looks/windFx';
import { UPDRAFT_FX } from '../data/windLook';
import { SKY_SUN } from '../data/skyLook';
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
/** The baked placements for this session's cube (G99): standalone, or a grid cell of the half width they were baked for. */
function skyPlacements(cube: { readonly half: number } | null): typeof PLACEMENTS_BAKED.standalone {
  if (cube === null) return PLACEMENTS_BAKED.standalone;
  if (cube.half !== PLACEMENTS_BAKED.half) throw new Error(`far-reach: placements baked for a ${String(PLACEMENTS_BAKED.half)} m cube, not ${String(cube.half)}`);
  return PLACEMENTS_BAKED.cell;
}
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
 * it rejects once the cell has unloaded, and the build stops). `looks` are the rope decks' wood and the hover frames' glow (`look.materials`).
 */
export async function buildWorld(ctx: ShardContext, pause: () => Promise<void>, isles: IsleMeshes, looks: { readonly deck: Material; readonly frame: Material }): Promise<BuiltWorld> {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const pieces = skyPieces(ctx.piece, root);
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove,
    keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  // SF49-g (G183): the four gate isles join the islands (every shape baked, generators/isles.ts; drawn from the props tiles,
  // generators/isleProps.ts, each at its own position); a playable island still takes its ISLE_DRAWS cosmetic values, so
  // every draw after the islands is unchanged
  for (const isle of [...ISLES, ...GATE_ISLES]) {
    const gate = GATE_ISLES.includes(isle), mesh = staticIsle(isles, isle.id); root.add(mesh);
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
  // E392/E399: the sky around the archipelago, the textured floating-island models (world/skyIsleHd.ts; one that did not load stands undrawn)
  // G99: in a grid cell only the isles inside the 500 m cube (ctx.cube); standalone every one: each placed offline (generators/placements.ts)
  const skyGroup = new Group(); skyGroup.name = 'far.sky-isles';
  const placed = skyPlacements(ctx.cube);
  skyGroup.add(skyIsleModels(placed.isles));
  await pause();
  // the playable islands' keels in the same painted rock (E399 round 2, seat C: 'under the bridge a flat sage-green cliff
  // wall'): a model under each island, its turf 1.8 m under the walkable top (its turf mounds poked up through the arena floor at 0.7 m), so
  // the rock below are the textured ones; the code top and its colliders are unchanged, nothing here collides
  const keels = skyIsleModels(PLACEMENTS_BAKED.keels, true);
  keels.name = 'far.isle-keels'; skyGroup.add(keels);
  await pause();
  pieces.add('far.sky-isles', skyGroup);
  // the modelled trees (top-10 row 2; none stand when a model did not load)
  pieces.add('far.pines', trees(placed.trees) ?? new Group());
  await pause();
  // the meadow and the roots (loop 2): grass clumps, flowers, stones, hanging roots; no colliders
  pieces.add('far.dressing', skyBakedPiece('dressing').root);
  await pause();
  // the skyline: decorative 3-D islands and waterfalls out past the archipelago, and the windmill isle's fall
  const sky = skyline(placed.falls); root.add(sky);
  await pause();

  const rope = flat(PALETTE.rope);
  // faint glass while you walk (E399, the council: 'translucent rectangles' over the windmill isle from the spawn): the glowing
  // frame shows the path; the plugin fills the glass in while you ride
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.16, depthWrite: false, flatShading: false, roughness: 0.15, metalness: 0.1 });
  // SF49-g (G183): each gate isle's rope bridge to its island is one more rope span of the same builder
  const bridges: Piece[] = [];
  for (const span of [...SPANS, ...RISING_ISLETS.map((entry) => entry.bridge)]) {
    const hover = span.kind === 'hover', length = spanLength(span), bridge = hover ? hoverBridge(length, span.width, hoverDeck, looks.frame) : ropeBridge(span.id, rope, looks.deck);
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
  const ramp = hoverBridge(UPDRAFT_LENGTH, UPDRAFT.width, hoverDeck, looks.frame);
  ramp.position.set(UPDRAFT.x0, UPDRAFT.y, UPDRAFT.z0); ramp.rotation.set(UPDRAFT_ANGLE, spanYaw(UPDRAFT), 0, 'YXZ');
  pieces.add('far.updraft', ramp, { colliders: spanColliders('far.updraft') });
  // the wind column: a spiral of streaks and leaves up the ramp (loop 3; the plugin turns it)
  const wind = updraftFx(UPDRAFT_FX, new Vector3(UPDRAFT.x0, UPDRAFT.y + 2.2, UPDRAFT.z0), new Vector3(UPDRAFT.x1, UPDRAFT.y1 + 2.2, UPDRAFT.z1));
  for (const o of wind.objects) root.add(o); wind.update(0);
  await pause();

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = ropeBridge(FALLEN_BRIDGE.id, rope, looks.deck);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0); fallen.rotation.set(FALLEN_ANGLE, spanYaw(FALLEN_BRIDGE), 0, 'YXZ');
  pieces.add(FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(FALLEN_BRIDGE.id), active: () => state.raised });

  await pause();
  const mill = windmill(); pieces.add('far.windmill', mill.group, { colliders: propColliders('far.windmill') });

  await pause();
  pieces.add('far.winch', winch(), { colliders: propColliders('far.winch') });
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
  const stormTex = seaTexture(); ctx.scope.own(stormTex);
  const storm = crownStorm(new Vector3(...SKY_SUN), stormTex, rnd); storm.group.position.set(CROWN.x, CROWN.y + STORM.lift, CROWN.z - STORM.ahead); storm.group.rotation.x = STORM.lean; root.add(storm.group);

  await pause();
  const islets = isletViews();
  root.add(islets.group);
  ctx.root.add(root); ownPrimitives(root, ctx.scope);
  return { hoverDeck, wind, fallen, millHub: mill.hub, storm, vanes, winch: handle, winchAt, notes, notesAt, state, islets };
}

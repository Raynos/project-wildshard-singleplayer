import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { ISLE_CUT_EDITS } from '../data/paintLook';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc, type Piece } from '@wildshard/engine/world/registry';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Euler, Group, Quaternion, Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, DECK, FALLEN_BRIDGE, ISLES, KNOLLS, MILL, NOTES, PINES, SPANS, STEP, SUNREST, UPDRAFT, VANES, WINCH, WINCH_HOUSE, type Isle, type Span } from '../data/layout';
import { apothem, ropeSag } from '../layout';
import { STRINGS } from '../data/strings';
import { dressIslands } from './dressing';
import { islandMesh } from './isle';
import { crownArena } from './crown';
import { firSheet, firs } from './fir';
import { trees } from './trees';
import { SKY_ISLES } from '../data/skyIsles';
import { inCube, skyIslesIn } from './skyIsles';
import { ISLE_CUT, ISLE_KEEL_CUT, keelIsles, skyIsleModels } from './skyIsleHd';
import { skyBakedPiece, skyKnollHulls } from './baked';
import { skyline } from './distant';
import { PALETTE, flat, pines, plankBridge, vane, windmill, winch } from './shapes';
import { bookStand } from './bookStand';
import { BOOK_STAND } from '../data/bookStand';
import { MILL_DRUM } from './mill';
import { KEEPER_STAND } from '../quest/keeper';
import { ownPrimitives } from './resources';
import { crownStorm, type CrownStorm } from './storm';
import { STORM } from '../data/storm';
import { updraftFx, type UpdraftFx } from '@wildshard/sdk/looks/windFx';
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

/** Six strips 30° apart cover an island's 12-gon top exactly; each strip's corners stay inside the rim circle. */
export function islandColliders(isle: Isle): ColliderDesc[] {
  const half = apothem(isle), width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => boxDesc({ x: isle.x, z: isle.z, hw: half, hd: width, rot: (i * Math.PI) / 6, yBottom: isle.y - 2, yTop: isle.y }, 'grass'));
}
/** A span's run: its horizontal heading (yaw, the bridge's local −Z) and its slope (pitch, raising the far end). */
export const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.y1 - span.y, span.z1 - span.z0);
export const spanYaw = (span: Span): number => Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0));
export const spanPitch = (span: Span): number => Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0));
/** The updraft's climb (radians; under the 40° walk limit) and its run along the slope. */
export const UPDRAFT_ANGLE = spanPitch(UPDRAFT);
export const UPDRAFT_LENGTH = spanLength(UPDRAFT);
/** A box in the span's own frame (local −Z down the span from its start, +Y the deck's up): centre, half sizes. */
function spanBox(span: Span, centre: [number, number, number], half: [number, number, number], surface: 'wood'): ColliderDesc {
  const q = new Quaternion().setFromEuler(new Euler(spanPitch(span), spanYaw(span), 0, 'YXZ'));
  const c = new Vector3(...centre).applyQuaternion(q).add(new Vector3(span.x0, span.y, span.z0));
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: half[0], hy: half[1], hz: half[2], rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface };
}
/** The deck under a span (loop 5: any heading, sloped between two decks), its top on the deck line. */
export function deckCollider(span: Span): ColliderDesc {
  const len = spanLength(span);
  return spanBox(span, [0, -0.15, -len / 2], [span.width / 2, 0.15, len / 2], 'wood');
}
/**
 * A rope span's deck and rails along its sag (layout ropeSag), as ~2 m chords, each its own short sloped span, overlapping
 * a little so the joins have no seam (a chord sits at most a few mm above the curve).
 */
export function saggedColliders(span: Span): ColliderDesc[] {
  const len = spanLength(span), n = Math.max(1, Math.ceil(len / 2)), out: ColliderDesc[] = [];
  const at = (s: number): { x: number; y: number; z: number } => {
    const f = s / len; return { x: span.x0 + (span.x1 - span.x0) * f, y: span.y + (span.y1 - span.y) * f - ropeSag(len, s), z: span.z0 + (span.z1 - span.z0) * f };
  };
  for (let i = 0; i < n; i++) {
    const a = at(Math.max(0, (i / n) * len - 0.05)), b = at(Math.min(len, ((i + 1) / n) * len + 0.05));
    const chord: Span = { ...span, x0: a.x, z0: a.z, y: a.y, x1: b.x, z1: b.z, y1: b.y };
    out.push(deckCollider(chord), ...railColliders(chord));
  }
  return out;
}
/** Rope rails along both long sides of a span. */
export function railColliders(span: Span): ColliderDesc[] {
  const len = spanLength(span);
  return [-1, 1].map((side) => spanBox(span, [side * span.width / 2, 0.55, -len / 2], [0.06, 0.55, len / 2], 'wood'));
}
/** The updraft's sloped deck (round 2: a span like the bridges, any heading): its top runs up the column to the step. */
export function updraftCollider(): ColliderDesc { return deckCollider(UPDRAFT); }
/**
 * A vane's colliders, measured off the generated shrine (C6, fitted 3.6 m tall on its footing): the stone plinth
 * (0.9 × 0.85 m up to 0.8 m), the shrine box above it (1.25 × 0.6 m to 1.5 m), then the 0.3 m post to the rotor.
 */
export function vaneColliders(x: number, z: number, y: number): ColliderDesc[] {
  return [
    boxDesc({ x, z: z - 0.02, hw: 0.45, hd: 0.43, rot: 0, yBottom: y, yTop: y + 0.8 }, 'stone'),
    boxDesc({ x: x + 0.04, z: z - 0.03, hw: 0.62, hd: 0.3, rot: 0, yBottom: y + 0.8, yTop: y + 1.5 }, 'stone'),
    boxDesc({ x, z, hw: 0.15, hd: 0.15, rot: 0, yBottom: y + 1.5, yTop: y + 3.2 }, 'wood'),
  ];
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
/** The rock drum under the mill (mill.ts MILL_DRUM): a convex ring of stone, MILL_DRUM.h proud of the deck. */
function millDrum(): ColliderDesc {
  const n = MILL_DRUM.sides, points = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.cos(a) * MILL_DRUM.r, z = Math.sin(a) * MILL_DRUM.r;
    points.set([x, -0.2, z, x, MILL_DRUM.h, z], i * 6);
  }
  return { kind: 'hull', x: MILL.x, y: DECK, z: MILL.z, points, surface: 'stone' };
}
/** The world, with SF49-g's four Rising Islet entries (G183; the only way in since G194). */
export function buildWorld(ctx: ShardContext): BuiltWorld {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove,
    keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  // SF49-g (G183): the four gate isles join the islands, drawn on their own seeded stream (the off path's look is untouched)
  let gateSeed = 1830;
  const gateRnd = (): number => { gateSeed = (gateSeed * 16807) % 2147483647; return gateSeed / 2147483647; };
  for (const isle of [...ISLES, ...GATE_ISLES]) {
    const gate = GATE_ISLES.includes(isle), mesh = islandMesh(isle, gate ? gateRnd : rnd); mesh.position.set(isle.x, isle.y, isle.z); root.add(mesh);
    // the code keel ends a little under the lip (E399 round 3, item 2: 'under the bridge a grey-green cliff wall where the
    // mockups show open cloud'): the textured keel model below (far.isle-keels) is the rock you see, narrower, with sky
    // round it; the top, the lip and every collider are unchanged (a gate isle has no keel model: its code keel stays whole)
    if (!gate) patchShader(mesh.material, 'far.isle-cut', PATCH_ORDER.decorate, (shader) => {
      shader.uniforms['farCut'] = { value: isle.y - (CUT[isle.id]?.cut ?? ISLE_CUT) };
      editShader(shader, ISLE_CUT_EDITS);
    }, { key: (prior) => `${prior}|far.isle-cut` });
    ctx.piece({ id: `far.isle.${isle.id}`, name: names[isle.id] ?? (gate ? STRINGS.gateIsle : isle.id), category: 'ground', file: FILE, object: mesh, colliders: islandColliders(isle), surface: 'grass' });
  }
  // the grassy rises (E399: proposal B's hill on the bridge's axis, mockup D's look down into the arena), walkable on their hulls
  // (SF72: built offline, generators/knoll.ts → baked/knolls.glb; each collided by its rows' hull)
  const knolls = skyBakedPiece('knolls'), hulls = skyKnollHulls();
  for (const k of KNOLLS) {
    const isle = ISLES.find((i) => i.id === k.isle), hull = hulls.get(k.id); if (isle === undefined || hull === undefined) continue;
    const knoll = knolls.kinds.get(k.id) ?? new Group(); knoll.name = `far.knoll.${k.id}`; root.add(knoll);
    ctx.piece({ id: `far.${k.id}.knoll`, name: names[isle.id] ?? isle.id, category: 'ground', file: FILE, object: knoll, colliders: [hull], surface: 'grass' });
  }
  const pineAt: [number, number, number, number][] = [];
  for (const isle of ISLES) for (const [dx, dz, s] of PINES[isle.id] ?? []) pineAt.push([isle.x + dx, isle.y, isle.z + dz, s]);
  // a pine on each gate isle beside the chain posts (the board's tree over the islet)
  for (const isle of GATE_ISLES) pineAt.push([isle.x + 3, isle.y, isle.z - 3, 0.9]);
  // the sky around the archipelago (E392): decorative isles from the same builder, their own seeded stream
  let skySeed = 9001;
  const skyRnd = (): number => { skySeed = (skySeed * 16807) % 2147483647; return skySeed / 2147483647; };
  // E392/E399: the textured floating-island models (world/skyIsleHd.ts) where they loaded, the code builder for the rest
  const skyGroup = new Group(); skyGroup.name = 'far.sky-isles';
  // G99: in a grid cell only the isles inside the 500 m cube (ctx.cube); standalone every one
  const skyIsles = skyIslesIn(ctx.cube), half = ctx.cube?.half ?? null;
  const skyHd = skyIsleModels(skyIsles); skyGroup.add(skyHd.group);
  // the playable islands' keels in the same painted rock (E399 round 2, seat C: 'under the bridge a flat sage-green cliff
  // wall'): a model under each island, its turf 1.8 m under the walkable top (its turf mounds poked up through the arena floor at 0.7 m), so
  // the rock below are the textured ones; the code top and its colliders are unchanged, nothing here collides
  const keels = skyIsleModels(keelIsles(ISLES), true);
  keels.group.name = 'far.isle-keels'; skyGroup.add(keels.group);
  for (const s of SKY_ISLES) {
    // an isle out of the cube still draws its pines' numbers, so the seeded stream (and every isle inside) matches standalone
    const kept = half === null || inCube(s, half), code = kept && skyHd.fallback.includes(s);
    if (code) { const mesh = islandMesh(s, skyRnd); mesh.position.set(s.x, s.y, s.z); skyGroup.add(mesh); }
    for (let k = 0; k < s.pines; k++) {
      const a = skyRnd() * Math.PI * 2, d = s.r * (0.2 + skyRnd() * 0.55), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, size = 0.7 + skyRnd() * 0.5;
      if (!kept) continue;
      // on a model, the fir stands on its turf (a little sunk), or not at all where the turf is not
      const y = code ? s.y : skyHd.topAt(s, x, z); if (y !== null) pineAt.push([x, code ? y : y - 0.2, z, size]);
    }
  }
  root.add(skyGroup);
  ctx.piece({ id: 'far.sky-isles', name: STRINGS.skyIsles, category: 'props', file: FILE, object: skyGroup });
  // the card-branch firs when the branch sheet loaded (E392), else the code pines
  // the modelled trees (top-10 row 2) where they loaded, else the card-branch firs (E392), else the code pines
  const sheet = firSheet(), forest = trees(pineAt) ?? (sheet !== null ? firs(pineAt, sheet) : pines(pineAt)); root.add(forest);
  ctx.piece({ id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE, object: forest });
  // the meadow and the roots (loop 2): grass clumps, flowers, stones, hanging roots; no colliders
  const dress = dressIslands(); root.add(dress.group);
  ctx.piece({ id: 'far.dressing', name: STRINGS.meadow, category: 'props', file: FILE, object: dress.group });
  // the skyline: decorative 3-D islands and waterfalls out past the archipelago, and the windmill isle's fall
  const sky = skyline(ISLES, (isle, a) => skyHd.lipAt(isle, a), skyIsles); root.add(sky);

  const plank = flat(PALETTE.plank), rope = flat(PALETTE.rope);
  // faint glass while you walk (E399, the council: 'translucent rectangles' over the windmill isle from the spawn): the glowing
  // frame shows the path; the plugin fills the glass in while you ride
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.16, depthWrite: false, flatShading: false, roughness: 0.15, metalness: 0.1 });
  // SF49-g (G183): each gate isle's rope bridge to its island is one more rope span of the same builder
  const bridges = [...SPANS, ...RISING_ISLETS.map((entry) => entry.bridge)].map((span): Piece => {
    const hover = span.kind === 'hover', length = spanLength(span), bridge = plankBridge(length, span.width, hover ? hoverDeck : plank, hover ? null : rope);
    bridge.position.set(span.x0, span.y, span.z0); bridge.rotation.set(spanPitch(span), spanYaw(span), 0, 'YXZ');
    const piece: Piece = { id: span.id, name: hover ? STRINGS.hover : STRINGS.rope, category: 'buildings', file: FILE, object: bridge,
      colliders: hover ? [deckCollider(span)] : saggedColliders(span), surface: 'wood' };
    if (hover) piece.mode = 'board'; // SF34: a hover-only deck, solid only under the board
    return piece;
  });
  // SF49-g (G183): the Rising Islets' static parts (the road lips, the chain posts); the islets move in the plugin's movers
  // G200: played alone (no road beyond the lips) each lip ends at a railed timber sky dock with a beacon; in a grid cell the
  // road socket continues there, so no dock
  for (const piece of [...bridges, ...isletPieces(), ...skyDocksFor(ctx.cube)]) { if (piece.object !== undefined) root.add(piece.object); ctx.piece(piece); }

  // The updraft: a board-only rising wind ramp (a hover deck tilted up the wind column) from the windmill isle to the step.
  const ramp = plankBridge(UPDRAFT_LENGTH, UPDRAFT.width, hoverDeck, null);
  ramp.position.set(UPDRAFT.x0, UPDRAFT.y, UPDRAFT.z0); ramp.rotation.set(UPDRAFT_ANGLE, spanYaw(UPDRAFT), 0, 'YXZ'); root.add(ramp);
  // the wind column: a spiral of streaks and leaves up the ramp (loop 3; the plugin turns it)
  const wind = updraftFx(UPDRAFT_FX, new Vector3(UPDRAFT.x0, UPDRAFT.y + 2.2, UPDRAFT.z0), new Vector3(UPDRAFT.x1, UPDRAFT.y1 + 2.2, UPDRAFT.z1));
  for (const o of wind.objects) root.add(o); wind.update(0);
  ctx.piece({ id: 'far.updraft', name: STRINGS.updraft, category: 'buildings', file: FILE, object: ramp, colliders: [updraftCollider()], surface: 'wood', mode: 'board' });

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = plankBridge(spanLength(FALLEN_BRIDGE), FALLEN_BRIDGE.width, plank, rope, false);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0); fallen.rotation.set(FALLEN_ANGLE, spanYaw(FALLEN_BRIDGE), 0, 'YXZ'); root.add(fallen);
  ctx.piece({ id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, object: fallen,
    colliders: [deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], surface: 'wood', active: () => state.raised });

  const mill = windmill(); mill.group.position.set(MILL.x, 30, MILL.z); mill.group.rotation.y = MILL.yaw; root.add(mill.group);
  ctx.piece({ id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, object: mill.group,
    colliders: [boxDesc({ x: MILL.x, z: MILL.z, hw: 2.3, hd: 2.3, rot: -MILL.yaw, yBottom: 30, yTop: 39 }, 'stone'), millDrum()], surface: 'stone' });

  const drum = winch(); drum.position.set(WINCH.x, WINCH.y, WINCH.z); root.add(drum);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: drum,
    colliders: [boxDesc({ x: WINCH.x, z: WINCH.z, hw: 0.8, hd: 0.2, rot: 0, yBottom: WINCH.y, yTop: WINCH.y + 1.2 }, 'wood')], surface: 'wood' });
  const winchAt = new Vector3(WINCH.x, WINCH.y + 1.2, WINCH.z);
  const handle: Interactable = { label: STRINGS.turnWinch, position: winchAt, radius: 3, onInteract: () => { if (!state.raised) state.raising = true; } };

  const page = bookStand(false); page.position.set(NOTES.x, NOTES.y, NOTES.z); page.rotation.y = 0.6; root.add(page);
  ctx.piece({ id: 'far.notes', name: STRINGS.notesName, category: 'props', file: FILE, object: page,
    colliders: [boxDesc({ x: NOTES.x, z: NOTES.z, hw: 0.3, hd: 0.3, rot: 0.6, yBottom: NOTES.y, yTop: NOTES.y + 1.1 }, 'wood')], surface: 'wood' });
  // the keeper's own book stand and lantern beside him at the spawn (E399, mockup B)
  const stand = bookStand(true); stand.position.set(KEEPER_STAND.x, SUNREST.y, KEEPER_STAND.z); stand.rotation.y = KEEPER_STAND.yaw; root.add(stand);
  ctx.piece({ id: 'far.keeper.stand', name: STRINGS.notesName, category: 'props', file: FILE, object: stand,
    colliders: [boxDesc({ x: KEEPER_STAND.x, z: KEEPER_STAND.z, hw: BOOK_STAND.footprint, hd: BOOK_STAND.footprint, rot: KEEPER_STAND.yaw, yBottom: stand.position.y, yTop: stand.position.y + BOOK_STAND.height }, 'wood')], surface: 'wood' });
  const notesAt = new Vector3(NOTES.x, NOTES.y + 1.3, NOTES.z);
  const notes: Interactable = { label: STRINGS.readNotes, position: notesAt, radius: 2.6, onInteract: () => undefined };

  const vanes = VANES.map((v) => {
    const built = vane(); built.group.position.set(v.x, v.y, v.z); root.add(built.group);
    ctx.piece({ id: `far.vane.${v.id}`, name: STRINGS.vane, category: 'props', file: FILE, object: built.group,
      colliders: vaneColliders(v.x, v.z, v.y), surface: 'wood' });
    return { id: v.id, at: new Vector3(v.x, v.y + 3.3, v.z), rotor: built.rotor };
  });

  // the arena (loop 4, mockup D): standing stones with wind glyphs, pennant ropes, the compass-rose dais
  // (SF72: built offline, generators/crown.ts → baked/crown.glb; its colliders, the dais and each stone, are the rows')
  const arena = crownArena(); root.add(arena.group);
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
  const stormTex = seaTexture(); ctx.scope.own(stormTex);
  const storm = crownStorm(SUN_DIR, stormTex, rnd); storm.group.position.set(CROWN.x, CROWN.y + STORM.lift, CROWN.z - STORM.ahead); storm.group.rotation.x = STORM.lean; root.add(storm.group);

  const islets = isletViews();
  root.add(islets.group);
  ctx.root.add(root); ownPrimitives(root, ctx.scope);
  return { hoverDeck, wind, fallen, millHub: mill.hub, storm, vanes, winch: handle, winchAt, notes, notesAt, state, islets };
}
